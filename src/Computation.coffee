
emptyFunction = require "emptyFunction"
assertType = require "assertType"
Tracer = require "tracer"
isDev = require "isDev"
Type = require "Type"

Tracker = require "./Tracker"

nextId = 1

type = Type "Tracker_Computation"

type.defineArgs
  func: Function.isRequired
  options:
    keyPath: String
    async: Boolean
    onError: Function

type.defineValues (func, options) ->

  id: nextId++

  keyPath: options.keyPath

  isActive: no

  isInvalidated: no

  isAsync: options.async ? yes

  _func: func

  _parent: options.parent or Tracker.currentComputation

  _onError: options.onError

  _isRecomputing: no

  _invalidateCallbacks: []

  _stopCallbacks: []

  _trace: isDev and emptyFunction

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
    @_compute()
    if Tracker.isActive
      Tracker.onInvalidate @stop
    return

  invalidate: ->

    return if @isInvalidated
    @isInvalidated = yes
    @_didInvalidate()

    if isDev
      @_trace = Tracer "computation.invalidate()"

    return unless @isActive

    if @isAsync
      return if @_isRecomputing
      Tracker._pendingComputations.push this
      Tracker._requireFlush()
      return

    @_recompute()
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
    catch error
      @stop()
      if @_onError
      then @_onError error
      else throw error
    finally
      Tracker._setCurrentComputation outerComputation
      Tracker._inCompute = wasComputing

  _needsRecompute: ->
    @isInvalidated and @isActive

  _recompute: ->
    if @_needsRecompute()
      @_isRecomputing = yes
      try @_compute()
      finally
        @_isRecomputing = no

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
