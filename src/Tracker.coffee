
{ throwFailure } = require "failure"

Type = require "Type"

type = Type "Tracker"

type.defineValues

  isActive: no

  currentComputation: null

  _computations: -> {}

  _pendingComputations: -> []

  _afterFlushCallbacks: -> []

  _willFlush: no

  _inFlush: no

  _inCompute: no

type.bindMethods [
  "_runFlush"
  "_requireFlush"
]

type.defineMethods

  flush: (options = {}) ->
    options.finishSynchronously ?= yes
    @_runFlush options
    return

  autorun: (func, options = {}) ->
    assertType func, Function
    options.func = func
    computation = @Computation options
    computation.start()
    return computation

  nonreactive: (func) ->
    assertType func, Function
    previous = @currentComputation
    @_setCurrentComputation null
    try func()
    finally
      @_setCurrentComputation previous

  onInvalidate: (callback) ->
    assert @isActive, "'onInvalidate' cannot be called when 'active' is false!"
    @currentComputation.onInvalidate callback
    return

  afterFlush: (callback) ->
    assertType callback, Function
    @_afterFlushCallbacks.push callback
    @_requireFlush()
    return

  _setCurrentComputation: (computation) ->
    @currentComputation = computation
    @isActive = computation?

  _requireFlush: ->
    return if @_willFlush
    setImmediate @_runFlush
    @_willFlush = yes

  _runFlush: (options = {}) ->

    assert not @_inFlush,
      reason: "Cannot call 'flush' during a flush!"

    assert not @_inCompute,
      reason: "Cannot call 'flush' during a computation!"

    @_inFlush = yes
    @_willFlush = yes

    pending = @_pendingComputations
    callbacks = @_afterFlushCallbacks
    recomputedCount = 0
    finishedTry = no
    try

      while pending.length or callbacks.length

        while pending.length
          computation = pending.shift()
          computation._recompute()
          if computation._needsRecompute()
            pending.unshift computation

          continue if options.finishSynchronously

          recomputedCount += 1
          continue if recomputedCount <= 1000

          finishedTry = yes
          return

        if callbacks.length
          callback = callbacks.shift()
          try callback()
          catch error
            throwFailure error, { callback }

      finishedTry = yes

    finally

      unless finishedTry
        @_inFlush = no
        @_runFlush options

      @_willFlush = no
      @_inFlush = no

      if pending.length or callbacks.length
        assert not options.finishSynchronously
        setTimeout @_requireFlush, 10

module.exports = type.construct()
