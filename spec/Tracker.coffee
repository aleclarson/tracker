
Tracker = require ".."

describe "Tracker.nonreactive", ->

  it "prevents dependencies from being depended on", ->
    dep = Tracker.Dependency()
    c = Tracker.Computation func: ->
      Tracker.nonreactive -> dep.depend()
    c.start()
    expect Object.keys(dep._dependentsById)
      .toEqual []
