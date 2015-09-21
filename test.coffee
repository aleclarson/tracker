
log = require "../lotus-log"
define = require "../define"

Tracker = require "."

obj = define {},
  a:
    reactive: yes

Tracker.autorun ->
  log.format obj.a, "obj.a = "

obj.a = 0

setInterval (->), Infinity
