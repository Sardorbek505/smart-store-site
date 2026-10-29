"""Build a deterministic displacement field (data texture, not a site photograph).

R/G encode the sampling displacement; B encodes the peripheral effect mask.
The centre has mask 0, so the filter always uses unmodified source pixels there.
"""
from pathlib import Path
import math,struct,zlib,sys
ROOT=Path(__file__).resolve().parents[1]
W,H=256,128

def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def byte(v):return max(0,min(255,round(v*255)))
def chunk(name,data):
 return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
def build(name,minimum,span):
 rows=[]
 for j in range(H):
  y=j/(H-1);row=bytearray([0])
  for i in range(W):
   x=i/(W-1)
   extent=minimum+span*math.sin(math.pi*y)**.65
   left=1-smooth(x/extent);right=1-smooth((1-x)/extent)
   edge=left+right;direction=left-right
   bow=.30+.70*math.sin(math.pi*y)**2
   r=.5+.40*direction*bow
   g=.5+.32*edge*math.sin(2*math.pi*y)
   row.extend((byte(r),byte(g),byte(smooth(edge/.35))))
  rows.append(row)
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',W,H,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
 file=ROOT/'img'/name
 if '--check' in sys.argv:
  if file.read_bytes()!=png:raise SystemExit('Stale hero displacement field: '+name)
 else:file.write_bytes(png)
 print(f'Hero refraction field: {name}, {W}x{H}, {len(png)} bytes')

build('hero-refraction-field-v82.png',.025,.055)
# A phone needs a wider contact area: the adjacent cards otherwise expose only
# their flat backgrounds to the desktop lens, hiding all displacement at rest.
build('hero-refraction-mobile-v83.png',.045,.115)
