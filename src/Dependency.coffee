
hasKeys = require "hasKeys"
Type = require "Type"

Tracker = require "./Tracker"

type = Type "Tracker_Dependency"

type.defineValues

  _dependentsById: -> {}

type.defineMethods

  depend: (computation) ->

    unless computation
      return no unless Tracker.isActive
      computation = Tracker.currentComputation

    id = computation.id
    self = this
    unless @_dependentsById[id]
      @_dependentsById[id] = computation
      computation.onInvalidate =>
        delete @_dependentsById[id]
      return yes
    return no

  changed: ->
    for id, computation of @_dependentsById
      computation.invalidate()
    return

  hasDependents: ->
    hasKeys @_dependentsById

module.exports = type.build()
