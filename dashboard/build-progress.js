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
  // Use one GitHub workflow run as the source of truth for both progress and downloads.
  // GitHub can report created_at slightly before dispatch; known run IDs take precedence.
  function selectCurrentRun(runs, dispatch, repoName, branch, now = Date.now()) {
    const history = Array.isArray(runs) ? runs : [];
    const pending = !!(dispatch && dispatch.repo === repoName &&
      dispatch.branch === branch && now - dispatch.at >= 0 &&
      now - dispatch.at < 120000);
    const candidates = pending ? history.filter(run => {
      const unseen = Array.isArray(dispatch.knownRunIds) &&
        !dispatch.knownRunIds.includes(run.id);
      return unseen || new Date(run.created_at).getTime() >= dispatch.at - 10000;
    }) : history;
    const active = run => run.status !== "completed";
    const current = pending ?
      (candidates.find(active) || candidates[0] || history.find(active) || null) :
      (history.find(active) || history[0] || null);
    return { current, pending };
  }
  return { summarize, selectCurrentRun };
});
