# Drive the desktop todo with real X input (XTest) on a private display; usage: desktop_input.py DISPLAY
# Layout (src/desktop.js): todo i toggle button at x 20..400, y 110+34i..+30; delete at x 410..450.
import sys, time
from Xlib import X, display, XK
from Xlib.ext import xtest

d = display.Display(sys.argv[1])
def move(x, y): xtest.fake_input(d, X.MotionNotify, x=x, y=y); d.sync(); time.sleep(0.25)
def click(x, y):
    move(x, y)
    xtest.fake_input(d, X.ButtonPress, 1); d.sync(); time.sleep(0.15)
    xtest.fake_input(d, X.ButtonRelease, 1); d.sync(); time.sleep(0.25)
def key(name):
    kc = d.keysym_to_keycode(XK.string_to_keysym(name))
    xtest.fake_input(d, X.KeyPress, kc); d.sync(); time.sleep(0.12)
    xtest.fake_input(d, X.KeyRelease, kc); d.sync(); time.sleep(0.15)

time.sleep(1.5)                       # let the window come up
click(100, 160)                       # toggle todo #2 ("write the docs")
for ch in "hello": key(ch)            # type a new todo
key("Return")                         # submit it
click(430, 125)                       # delete todo #1 ("buy milk")
key("Escape")                         # raylib's default exit key
