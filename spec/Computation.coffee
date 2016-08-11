
Tracker = require ".."

describe "Tracker.Computation", ->

  it "depends on every referenced Tracker.Dependency", ->
    depA = Tracker.Dependency()
    depB = Tracker.Dependency()
    c = Tracker.Computation func: ->
      depA.depend()
      depB.depend()
    c.start()
    expect Object.keys(depA._dependentsById)
      .toEqual [ String(c.id) ]
    expect Object.keys(depB._dependentsById)
      .toEqual [ String(c.id) ]

  it "re-runs whenever a dependency changes", ->
    value = 0
    spy = jasmine.createSpy()
    dep = Tracker.Dependency()
    func = ->
      dep.depend()
      spy value
    c = Tracker.Computation { func, async: no }
    c.start()
    value = 1
    dep.changed()
    expect spy.calls.count()
      .toBe 2
