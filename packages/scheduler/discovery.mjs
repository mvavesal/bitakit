/**
 * Tasks and schedules run on the server: their files live in
 * `server/contributions/tasks|schedules/`. Until the next minor version the old place
 * `contributions/tasks|schedules/` keeps running where it ran before (the browser composition),
 * with a warning; `bitakit migrate` moves those files.
 */
export default function discovery() {
  return ['tasks', 'schedules'].map((directory) => ({
    name: `scheduler.${directory}`,
    directory,
    runtime: 'server',
    movedFrom: 'client',
    from: '@bitakit/scheduler',
    normalize: directory === 'tasks' ? 'discoverTasks' : 'discoverSchedules',
    types: {
      entry: directory === 'tasks' ? 'TaskEntry' : 'ScheduleEntry',
      map: directory === 'tasks' ? 'TaskMap' : 'ScheduleMap',
    },
  }));
}
