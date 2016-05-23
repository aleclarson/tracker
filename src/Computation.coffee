
require "isDev"

{ throwFailure } = require "failure"

assertType = require "assertType"
getArgProp = require "getArgProp"
Tracer = require "tracer"
Event = require "event"
Type = require "Type"

Tracker = require "./Tracker"

nextId = 1

type = Type "Tracker_Computation"

type.optionTypes =
  func: Function
  async: Boolean.Maybe
  keyPath: String.Maybe
  onError: Function

type.optionDefaults =
  async: yes
  onError: throwFailure

type.defineValues

  id: -> nextId++

  keyPath: getArgProp "keyPath"

  isActive: no

  isAsync: getArgProp "async"

  isFirstRun: yes

  isInvalidated: no

  _recomputing: no

  _parent: (options) -> options.parent or Tracker.currentComputation

  _func: getArgProp "func"

  _onError: getArgProp "onError"

  _didInvalidate: -> Event()

  _didStop: -> Event()

  _trace: null if isDev

type.initInstance ->
  Tracker._computations[@id] = this

type.bindMethods [
  "stop"
]

type.defineMethods

  start: ->

    return if @isActive
    @isActive = yes

    try @_compute()
    catch error
      @_reportError error
      @stop()

    @isFirstRun = no
    if Tracker.isActive
      Tracker.onInvalidate @stop
    return

  invalidate: ->

    return if @isInvalidated
    @isInvalidated = yes

    unless @isAsync
      if @isActive
        @_invalidate()
        @_recompute()
      return

    @_trace = Tracer "When computation was invalidated" if isDev

    unless @_recomputing or not @isActive
      Tracker._requireFlush()
      Tracker._pendingComputations.push this

    @_invalidate()
    return

  stop: ->

    return unless @isActive
    @isActive = no

    @invalidate()
    delete Tracker._computations[@id]

    return unless @_didStop.listenerCount
    Tracker.nonreactive =>
      @_didStop.emit()
      @_didStop.reset()
    return

  onInvalidate: (callback) ->
    assertType callback, Function
    if @isInvalidated
      Tracker.nonreactive callback
    else @_didInvalidate callback
    return

  onStop: (callback) ->
    assertType callback, Function
    unless @isActive
      Tracker.nonreactive callback
    else @_didStop callback
    return

  _invalidate: ->
    return unless @_didInvalidate.listenerCount
    Tracker.nonreactive =>
      @_didInvalidate.emit()
      @_didInvalidate.reset()
    return

  _compute: ->

    @isInvalidated = no

    previous = Tracker.currentComputation
    Tracker._setCurrentComputation this

    previousInCompute = Tracker._inCompute
    Tracker._inCompute = yes

    try @_func this
    finally
      Tracker._setCurrentComputation previous
      Tracker._inCompute = previousInCompute

  _needsRecompute: ->
    @isInvalidated and @isActive

  _recompute: ->

    @_recomputing = yes
    try
      if @_needsRecompute()
        try @_compute()
        catch error
          @_reportError error

    finally
      @_recomputing = no

  _reportError: (error) ->
    meta = stack: @_trace() if isDev and @_trace
    @_onError error, meta

module.exports = type.build()
