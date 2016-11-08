
# TODO: Avoid extraneous recomputations by providing a method for batching sync computations.

assertType = require "assertType"
assert = require "assert"
Type = require "Type"

type = Type "Tracker"

type.defineValues ->

  isActive: no

  currentComputation: null

  _computations: {}

  _pendingComputations: []

  _afterFlushCallbacks: []

  _willFlush: no

  _inFlush: no

  _inCompute: no

type.defineMethods

  flush: (isAsync = no) ->
    @_runFlush isAsync
    return

  autorun: (func, options = {}) ->
    assertType func, Function
    computation = @Computation func, options
    computation.start()
    return computation

  nonreactive: (context, func) ->
    if arguments.length is 1
      func = context
      context = null
    assertType func, Function
    previous = @currentComputation
    @_setCurrentComputation null
    try func.call context
    finally
      @_setCurrentComputation previous

  onInvalidate: (callback) ->
    assert @isActive, "'onInvalidate' cannot be called when 'isActive' is false!"
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
    @_willFlush = yes
    setImmediate => @_runFlush yes

  _runFlush: (isAsync) ->

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

          continue unless isAsync

          recomputedCount += 1
          continue if recomputedCount <= 1000

          finishedTry = yes
          return

        if callbacks.length
          callback = callbacks.shift()
          try callback()
          catch error
            GLOBAL.setImmediate -> throw error

      finishedTry = yes

    finally

      unless finishedTry
        @_inFlush = no
        @_runFlush isAsync

      @_willFlush = no
      @_inFlush = no

      if pending.length or callbacks.length
        assert isAsync, "Only async flushing should end up here!"
        setTimeout @_requireFlush, 10

module.exports = type.construct()
