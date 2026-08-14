import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType } from 'docx';
import * as XLSX from 'xlsx';

export const exportToWord = async (reportData: any, projectName?: string) => {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: projectName ? `${projectName} - Analytics Report` : 'Project Analytics Report',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: `Generated on: ${new Date().toLocaleDateString()}`,
          spacing: { after: 400 },
        }),
        
        // Project Statistics
        new Paragraph({
          text: 'Project Statistics',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Total Issues: ', bold: true }),
            new TextRun({ text: reportData.issueStats?.total?.toString() || '0' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Completed Issues: ', bold: true }),
            new TextRun({ text: (reportData.issueStats?.byStatus?.done || 0).toString() }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'In Progress: ', bold: true }),
            new TextRun({ text: (reportData.issueStats?.byStatus?.in_progress || 0).toString() }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Overdue Tasks: ', bold: true }),
            new TextRun({ text: reportData.issueStats?.overdueTasks?.toString() || '0' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Average Cycle Time: ', bold: true }),
            new TextRun({ text: `${reportData.projectStats?.avgCycleTime || 0} days` }),
          ],
        }),
        
        // Team Performance
        new Paragraph({
          text: 'Team Performance',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        ...createTeamPerformanceTable(reportData.teamPerformance || []),
        
        // Pending Tasks
        new Paragraph({
          text: 'Pending Tasks',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }),
        ...createPendingTasksList(reportData.issueStats?.pendingTasks || []),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName ? projectName + '-' : ''}report-${new Date().toISOString().split('T')[0]}.docx`;
  link.click();
  window.URL.revokeObjectURL(url);
};

const createTeamPerformanceTable = (teamPerformance: any[]) => {
  if (!teamPerformance || teamPerformance.length === 0) {
    return [new Paragraph({ text: 'No team performance data available' })];
  }

  return teamPerformance.slice(0, 10).map(member => 
    new Paragraph({
      children: [
        new TextRun({ text: `${member.name}: `, bold: true }),
        new TextRun({ text: `${member.issuesCompleted} completed, ${member.hoursLogged.toFixed(1)} hours logged` }),
      ],
      spacing: { after: 100 },
    })
  );
};

const createPendingTasksList = (pendingTasks: any[]) => {
  if (!pendingTasks || pendingTasks.length === 0) {
    return [new Paragraph({ text: 'No pending tasks' })];
  }

  return pendingTasks.slice(0, 20).map(task =>
    new Paragraph({
      children: [
        new TextRun({ text: `${task.title}`, bold: true }),
        new TextRun({ text: ` - Priority: ${task.priority}, Assignee: ${task.assignee}` }),
        task.daysOverdue > 0 ? new TextRun({ text: ` (Overdue by ${task.daysOverdue} days)`, color: 'FF0000' }) : new TextRun({ text: '' }),
      ],
      spacing: { after: 100 },
    })
  );
};

export const exportToExcel = (reportData: any, projectName?: string) => {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    ['Project Analytics Report'],
    [`Generated: ${new Date().toLocaleDateString()}`],
    [],
    ['Metric', 'Value'],
    ['Total Issues', reportData.issueStats?.total || 0],
    ['Completed Issues', reportData.issueStats?.byStatus?.done || 0],
    ['In Progress', reportData.issueStats?.byStatus?.in_progress || 0],
    ['To Do', reportData.issueStats?.byStatus?.to_do || 0],
    ['Overdue Tasks', reportData.issueStats?.overdueTasks || 0],
    ['Average Cycle Time (days)', reportData.projectStats?.avgCycleTime || 0],
    ['Throughput', reportData.projectStats?.throughput || 0],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Team Performance Sheet
  if (reportData.teamPerformance && reportData.teamPerformance.length > 0) {
    const teamData = [
      ['Name', 'Email', 'Completed', 'In Progress', 'Hours Logged', 'Avg Time to Complete', 'Efficiency', 'On-Time Delivery %'],
      ...reportData.teamPerformance.map((member: any) => [
        member.name,
        member.email,
        member.issuesCompleted,
        member.issuesInProgress,
        member.hoursLogged.toFixed(2),
        member.avgTimeToComplete.toFixed(1),
        member.efficiency.toFixed(2),
        member.onTimeDelivery.toFixed(1),
      ]),
    ];
    const teamSheet = XLSX.utils.aoa_to_sheet(teamData);
    XLSX.utils.book_append_sheet(workbook, teamSheet, 'Team Performance');
  }

  // Pending Tasks Sheet
  if (reportData.issueStats?.pendingTasks && reportData.issueStats.pendingTasks.length > 0) {
    const tasksData = [
      ['Title', 'Priority', 'Assignee', 'Due Date', 'Days Overdue', 'Project'],
      ...reportData.issueStats.pendingTasks.map((task: any) => [
        task.title,
        task.priority,
        task.assignee,
        task.dueDate || 'No due date',
        task.daysOverdue,
        task.project || 'Unknown',
      ]),
    ];
    const tasksSheet = XLSX.utils.aoa_to_sheet(tasksData);
    XLSX.utils.book_append_sheet(workbook, tasksSheet, 'Pending Tasks');
  }

  // Priority Analysis Sheet
  if (reportData.priorityAnalysis && reportData.priorityAnalysis.length > 0) {
    const priorityData = [
      ['Priority', 'Count', 'Avg Time to Complete (days)', 'Completion Rate %'],
      ...reportData.priorityAnalysis.map((p: any) => [
        p.priority,
        p.count,
        p.avgTimeToComplete,
        p.completionRate.toFixed(1),
      ]),
    ];
    const prioritySheet = XLSX.utils.aoa_to_sheet(priorityData);
    XLSX.utils.book_append_sheet(workbook, prioritySheet, 'Priority Analysis');
  }

  // Workload Distribution Sheet
  if (reportData.workloadDistribution && reportData.workloadDistribution.length > 0) {
    const workloadData = [
      ['Name', 'Current Workload (hrs)', 'Capacity (hrs)', 'Utilization %'],
      ...reportData.workloadDistribution.map((w: any) => [
        w.name,
        w.current,
        w.capacity,
        w.utilization.toFixed(1),
      ]),
    ];
    const workloadSheet = XLSX.utils.aoa_to_sheet(workloadData);
    XLSX.utils.book_append_sheet(workbook, workloadSheet, 'Workload');
  }

  // Export the file
  const fileName = `${projectName ? projectName + '-' : ''}report-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
