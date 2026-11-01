export default function discovery() {
  return ['tasks', 'schedules'].map((directory) => ({
    name: `scheduler.${directory}`,
    directory,
    from: '@bitakit/scheduler',
    normalize: directory === 'tasks' ? 'discoverTasks' : 'discoverSchedules',
    types: {
      entry: directory === 'tasks' ? 'TaskEntry' : 'ScheduleEntry',
      map: directory === 'tasks' ? 'TaskMap' : 'ScheduleMap',
    },
  }));
}
