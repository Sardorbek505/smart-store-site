"""Keyboard limits and mobile dialog exits in the isolated training store."""
from playwright.sync_api import sync_playwright
import os,json,shutil

BASE=os.environ.get('SITE_TEST_URL','http://127.0.0.1:4173').rstrip('/')
BROWSER=os.environ.get('BROWSER','chromium')
with sync_playwright() as p:
    options={'headless':True}
    if BROWSER=='chromium':options.update(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    browser=getattr(p,BROWSER).launch(**options)
    for w,h,touch in [(320,568,True),(390,844,True),(844,390,True),(1024,768,True),(1440,900,False)]:
        page=browser.new_page(viewport={'width':w,'height':h},is_mobile=w<=900,has_touch=touch,reduced_motion='reduce')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/demo/',wait_until='networkidle')
        page.locator('#demo-app').wait_for(state='visible')
        low=page.locator('[data-product="demo-8"]')
        low.locator('[data-action="add"]').focus()
        for _ in range(3):page.keyboard.press('Enter')
        assert low.locator('[data-action="add"]').is_disabled()
        assert low.locator('h3').evaluate('e=>document.activeElement===e'),'Exhausting stock must keep keyboard focus on the product'
        assert 'Весь остаток' in page.locator('#demo-notice').inner_text()
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement.closest("#product-grid")!==null'),'Tab must continue through the catalogue'
        if w<=900:page.locator('#cart-toggle').click()
        cart=page.locator('#cart-dialog' if w<=900 else '#receipt-panel')
        minus=cart.locator('[data-action="minus"][data-id="demo-8"]')
        minus.focus();page.keyboard.press('Enter');page.keyboard.press('Enter')
        quantity=cart.locator('.quantity output')
        assert quantity.inner_text()=='1'
        assert quantity.evaluate('e=>document.activeElement===e'),'Quantity one must not drop focus when minus becomes disabled'
        plus=cart.locator('[data-action="add"][data-id="demo-8"]')
        plus.focus();page.keyboard.press('Enter');page.keyboard.press('Enter')
        assert quantity.inner_text()=='3' and quantity.evaluate('e=>document.activeElement===e')
        cart.locator('[data-action="pay"]').click()
        page.get_by_label('Kaspi',exact=True).check();page.locator('#confirm-payment').click()
        page.locator('#result-dialog').wait_for(state='visible')
        page.locator('[data-close="result-dialog"]').click()
        expected='page-title' if touch or w<=900 else 'product-search'
        page.wait_for_function('(id)=>document.activeElement?.id===id',arg=expected)
        assert page.locator('#result-dialog').is_hidden()

        # Closing an empty mobile receipt also returns to a non-input target.
        page.locator('#product-search').fill('MK-DF333')
        page.locator('[data-product="demo-0"] [data-action="add"]').click()
        assert page.locator('[data-guide="2"]').get_attribute('aria-current')=='step'
        if w<=900:page.locator('#cart-toggle').click()
        cart.locator('[data-action="clear-cart"]').click()
        if w<=900:page.locator('[data-close="cart-dialog"]').click()
        page.wait_for_function('(id)=>document.activeElement?.id===id',arg=expected)

        # Reopened history receipts still restore their exact opener.
        page.locator('.app-nav a[data-route="reports"]').click()
        page.wait_for_function('document.body.dataset.route==="reports"')
        assert page.locator('.demo-guide').is_hidden()
        receipt=page.locator('[data-receipt="174"]')
        receipt.click();page.keyboard.press('Escape')
        page.wait_for_function('document.activeElement?.dataset.receipt==="174"')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        print(json.dumps({'browser':BROWSER,'viewport':[w,h],'touch':touch,'stockLimitFocus':'product heading','quantityLimitFocus':'quantity output','resultAndEmptyCartExit':expected,'receiptOpenerRestored':True,'errors':errors}),flush=True)
        page.close()
    browser.close()
