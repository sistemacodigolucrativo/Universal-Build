/* GitHub Actions reports workflow steps, not compiler progress by bytes or percent. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UniversalBuildProgress = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function summarize(run, jobs) {
    const status = run.conclusion || run.status;
    const active = !["success", "failure", "cancelled", "skipped", "timed_out", "action_required", "neutral"].includes(status);
    const all = (Array.isArray(jobs) ? jobs : []).flatMap(job =>
      (Array.isArray(job.steps) ? job.steps : []).filter(step =>
        !/^Post |^Set up job$|^Complete job$/i.test(step.name || "")));
    const total = all.length;
    const done = all.filter(step => step.status === "completed").length;
    const current = all.find(step => step.status === "in_progress") ||
      all.find(step => step.status !== "completed");
    const stage = status === "success" ? "Compilação concluída" :
      status === "failure" ? "Build falhou: consulte os logs" :
      status === "cancelled" ? "Execução cancelada" :
      current ? current.name : status === "queued" || status === "waiting" ?
      "Aguardando runner do GitHub" : "Aguardando etapas do GitHub Actions";
    const percent = status === "success" ? 100 :
      total > 0 ? Math.min(95, Math.floor(done / total * 100)) : null;
    return { status, active, stage, done, total, percent };
  }
  return { summarize };
});
