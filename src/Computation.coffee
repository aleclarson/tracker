
require "isDev"

{ throwFailure } = require "failure"

Tracer = require "tracer"
Type = require "Type"

Tracker = require "./Tracker"

nextId = 1

type = Type "Tracker_Computation"

type.optionTypes =
  func: Function
  onError: Function
  async: Boolean.Maybe
  keyPath: String.Maybe

type.defineValues

  id: -> nextId++

  keyPath: (options) -> options.keyPath

  isActive: no

  isInvalidated: no

  isFirstRun: yes

  isAsync: (options) -> options.async isnt no

  _recomputing: no

  _func: (options) -> options.func

  _parent: (options) -> options.parent or Tracker.currentComputation

  _errorCallback: (options) -> options.onError

  _invalidateCallbacks: -> []

  _stopCallbacks: -> []

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
      @_onError error
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
        @_onInvalidate()
        @_recompute()
      return

    @_trace = Tracer "When computation was invalidated" if isDev

    unless @_recomputing or not @isActive
      Tracker._requireFlush()
      Tracker._pendingComputations.push this

    @_onInvalidate()
    return

  stop: ->

    return unless @isActive
    @isActive = no

    @invalidate()

    delete Tracker._computations[@id]

    self = this
    Tracker.nonreactive ->
      callback self for callback in @_stopCallbacks
      return

    @_stopCallbacks.length = 0
    return

  onInvalidate: (callback) ->

    assertType callback, Function

    unless @isInvalidated
      @_invalidateCallbacks.push callback
      return

    Tracker.nonreactive ->
      callback self
    return

  onStop: (callback) ->

    assertType callback, Function

    if @isActive
      @_stopCallbacks.push callback
      return

    Tracker.nonreactive ->
      callback self
    return

  _onInvalidate: ->

    self = this
    Tracker.nonreactive ->
      callback self for callback in @_invalidateCallbacks
      return

    @_invalidateCallbacks.length = 0
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
          @_onError error

    finally
      @_recomputing = no

  _onError: (error) ->

    if isDev and @_trace
      data = stack: @_trace()

    if @_errorCallback
      @_errorCallback error, data
    else throwFailure error, data

module.exports = type.build()
