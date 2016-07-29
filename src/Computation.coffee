
require "isDev"

emptyFunction = require "emptyFunction"
assertType = require "assertType"
fromArgs = require "fromArgs"
Tracer = require "tracer"
Type = require "Type"

Tracker = require "./Tracker"

nextId = 1

type = Type "Tracker_Computation"

type.defineOptions
  func: Function.isRequired
  async: Boolean.withDefault yes
  keyPath: String
  onError: Function.withDefault (error) -> throw error

type.defineValues

  id: -> nextId++

  keyPath: fromArgs "keyPath"

  isActive: no

  isAsync: fromArgs "async"

  isFirstRun: yes

  isInvalidated: no

  _isRecomputing: no

  _parent: (options) -> options.parent or Tracker.currentComputation

  _func: fromArgs "func"

  _onError: fromArgs "onError"

  _invalidateCallbacks: -> []

  _stopCallbacks: -> []

  _trace: -> emptyFunction if isDev

type.initInstance ->
  Tracker._computations[@id] = this

type.defineBoundMethods

  stop: ->

    return if not @isActive
    @isActive = no

    @invalidate()
    delete Tracker._computations[@id]

    @_didStop()
    return

type.defineMethods

  start: ->

    return if @isActive
    @isActive = yes

    try @_compute()
    catch error then @stop()

    @isFirstRun = no
    if Tracker.isActive
      Tracker.onInvalidate @stop
    return

  invalidate: ->

    return if @isInvalidated
    @isInvalidated = yes

    isDev and @_trace = Tracer "computation.invalidate()"

    if @isActive
      if not @isAsync
        @_recompute()
      else if not @_isRecomputing
        Tracker._pendingComputations.push this
        Tracker._requireFlush()

    @_didInvalidate()
    return

  onInvalidate: (callback) ->

    assertType callback, Function

    if @isInvalidated
      Tracker.nonreactive callback
      return

    @_invalidateCallbacks.push callback
    return

  onStop: (callback) ->

    assertType callback, Function

    if @isActive
      @_stopCallbacks.push callback
      return

    Tracker.nonreactive callback
    return

  _compute: ->

    @isInvalidated = no

    outerComputation = Tracker.currentComputation
    Tracker._setCurrentComputation this

    wasComputing = Tracker._inCompute
    Tracker._inCompute = yes

    try @_func this
    finally
      Tracker._setCurrentComputation outerComputation
      Tracker._inCompute = wasComputing

  _needsRecompute: ->
    @isInvalidated and @isActive

  _recompute: ->
    return if not @_needsRecompute()
    @_isRecomputing = yes
    try @_compute()
    finally @_isRecomputing = no
    return

  _didStop: ->
    callbacks = @_stopCallbacks
    return if not callbacks.length
    Tracker.nonreactive ->
      callback() for callback in callbacks
      callbacks.length = 0
    return

  _didInvalidate: ->
    callbacks = @_invalidateCallbacks
    return if not callbacks.length
    Tracker.nonreactive ->
      callback() for callback in callbacks
      callbacks.length = 0
    return

module.exports = type.build()
