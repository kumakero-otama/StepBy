(function exposeStepByRecordFlowPolicy(global) {
  "use strict";
  function shouldOpenOsmConnection(state) {
    return Boolean(state && state.configured === true && state.connected !== true);
  }
  global.StepByRecordFlowPolicy = { shouldOpenOsmConnection };
})(window);
