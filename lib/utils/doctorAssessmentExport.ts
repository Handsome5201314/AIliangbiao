import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface DoctorAssessmentAnswerDetail {
  questionId: number;
  questionText: string;
  answerScore: number | null;
  answerLabel: string;
}

export interface DoctorAssessmentExportData {
  assessmentId: string;
  member: {
    nickname: string;
    relation: string;
    gender: string;
    ageMonths?: number | null;
  };
  scale: {
    id: string;
    name: string;
    version: string;
  };
  result: {
    totalScore: number;
    conclusion: string;
    details?: {
      description?: string;
      [key: string]: unknown;
    };
  };
  answerDetails: DoctorAssessmentAnswerDetail[];
  assessedAt: string;
  exportedAt: string;
}

function extractDimensionRows(details?: DoctorAssessmentExportData['result']['details']) {
  const dimensions =
    typeof details?.dimensions === 'object' && details.dimensions !== null
      ? (details.dimensions as Record<string, unknown>)
      : undefined;

  if (!dimensions) {
    return [];
  }

  return Object.entries(dimensions)
    .filter(([key, value]) => key !== 'functional_impact' && typeof value === 'object' && value !== null)
    .map(([key, value]) => {
      const entry = value as { label?: unknown; score?: unknown; maxScore?: unknown };
      const label = typeof entry.label === 'string' ? entry.label : key;
      const score = typeof entry.score === 'number' ? entry.score : undefined;
      const maxScore = typeof entry.maxScore === 'number' ? entry.maxScore : undefined;

      if (score === undefined) {
        return null;
      }

      return {
        label,
        display: maxScore !== undefined ? `${score} / ${maxScore}` : String(score),
      };
    })
    .filter((item): item is { label: string; display: string } => item !== null);
}

function normalizeFilenamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '_').trim();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function createFilename(data: DoctorAssessmentExportData, extension: string) {
  const nickname = normalizeFilenamePart(data.member.nickname || 'member');
  const scaleId = normalizeFilenamePart(data.scale.id);
  const assessedAt = normalizeFilenamePart(data.assessedAt.replace(/[: ]/g, '-'));
  return `${nickname}_${scaleId}_${assessedAt}.${extension}`;
}

function createReportMarkup(data: DoctorAssessmentExportData) {
  const scoreLabel =
    typeof data.result.details?.scoreLabel === 'string' ? data.result.details.scoreLabel : '总分';
  const scoreDisplay =
    typeof data.result.details?.scoreDisplay === 'string'
      ? data.result.details.scoreDisplay
      : String(data.result.totalScore);
  const totalScoreLabel =
    typeof data.result.details?.totalScoreLabel === 'string' ? data.result.details.totalScoreLabel : '总分';
  const totalScoreHint =
    typeof data.result.details?.totalScoreHint === 'string' ? data.result.details.totalScoreHint : '';
  const dimensionRows = extractDimensionRows(data.result.details);

  const answerRows = data.answerDetails
    .map((item) => {
      const score = item.answerScore === null ? '-' : String(item.answerScore);
      return `
        <tr>
          <td>${item.questionId}</td>
          <td>${item.questionText}</td>
          <td>${item.answerLabel}</td>
          <td>${score}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; color: #0f172a; background: white; width: 820px; padding: 28px;">
      <h1 style="margin: 0 0 8px; font-size: 28px;">单次评估结果报告</h1>
      <p style="margin: 0 0 20px; color: #64748b; font-size: 14px;">医生端导出 · 仅用于临床沟通与留档参考</p>

      <section style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 18px;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">成员信息</h2>
        <p style="margin: 4px 0;"><strong>昵称：</strong>${data.member.nickname}</p>
        <p style="margin: 4px 0;"><strong>关系：</strong>${data.member.relation}</p>
        <p style="margin: 4px 0;"><strong>性别：</strong>${data.member.gender}</p>
        <p style="margin: 4px 0;"><strong>月龄：</strong>${data.member.ageMonths ?? '未知'}</p>
      </section>

      <section style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 18px;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">评估信息</h2>
        <p style="margin: 4px 0;"><strong>量表：</strong>${data.scale.name}（${data.scale.id}）</p>
        <p style="margin: 4px 0;"><strong>版本：</strong>${data.scale.version}</p>
        <p style="margin: 4px 0;"><strong>评估时间：</strong>${data.assessedAt}</p>
        <p style="margin: 4px 0;"><strong>导出时间：</strong>${data.exportedAt}</p>
      </section>

      <section style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 18px;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">评估结果</h2>
        <p style="margin: 4px 0;"><strong>${scoreLabel}：</strong>${scoreDisplay}</p>
        ${scoreLabel !== totalScoreLabel ? `<p style="margin: 4px 0;"><strong>${totalScoreLabel}：</strong>${data.result.totalScore}</p>` : ''}
        <p style="margin: 4px 0;"><strong>结论：</strong>${data.result.conclusion}</p>
        ${dimensionRows.length ? `
          <div style="margin-top: 12px;">
            <p style="margin: 0 0 8px; font-weight: 600;">子领域得分</p>
            ${dimensionRows.map((item) => `<p style="margin: 4px 0;"><strong>${item.label}：</strong>${item.display}</p>`).join('')}
          </div>
        ` : ''}
        ${data.result.details?.description ? `<p style="margin: 12px 0 0; line-height: 1.8; white-space: pre-wrap;">${data.result.details.description}</p>` : ''}
        ${totalScoreHint ? `<p style="margin: 12px 0 0; color: #64748b; line-height: 1.8;">${totalScoreHint}</p>` : ''}
      </section>

      <section style="border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px;">
        <h2 style="margin: 0 0 12px; font-size: 18px;">答题明细</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 10px; border-bottom: 1px solid #cbd5e1;">题号</th>
              <th style="text-align: left; padding: 10px; border-bottom: 1px solid #cbd5e1;">题目</th>
              <th style="text-align: left; padding: 10px; border-bottom: 1px solid #cbd5e1;">作答</th>
              <th style="text-align: left; padding: 10px; border-bottom: 1px solid #cbd5e1;">分值</th>
            </tr>
          </thead>
          <tbody>${answerRows}</tbody>
        </table>
      </section>
    </div>
  `;
}

async function exportMarkupToPdf(markup: string, filename: string) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '820px';
  container.innerHTML = markup;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, (pdfHeight - 10) / imgHeight);
    const renderWidth = imgWidth * ratio;
    const pageHeightPx = (pdfHeight - 20) / ratio;

    let renderedOffset = 0;
    let pageIndex = 0;

    while (renderedOffset < imgHeight) {
      const sliceHeight = Math.min(pageHeightPx, imgHeight - renderedOffset);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = imgWidth;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext('2d');

      if (!context) {
        throw new Error('无法创建 PDF 导出上下文');
      }

      context.drawImage(canvas, 0, renderedOffset, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);

      const imgData = pageCanvas.toDataURL('image/png');
      const renderHeight = sliceHeight * ratio;

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'PNG', (pdfWidth - renderWidth) / 2, 10, renderWidth, renderHeight);
      renderedOffset += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

export function downloadDoctorAssessmentJson(data: DoctorAssessmentExportData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(blob, createFilename(data, 'json'));
}

export function downloadDoctorAssessmentCsv(data: DoctorAssessmentExportData) {
  const dimensionRows = extractDimensionRows(data.result.details);
  const rows: string[][] = [
    ['单次评估结果报告'],
    [],
    ['成员信息'],
    ['昵称', data.member.nickname],
    ['关系', data.member.relation],
    ['性别', data.member.gender],
    ['月龄', data.member.ageMonths ? `${data.member.ageMonths}` : ''],
    [],
    ['评估信息'],
    ['量表名称', data.scale.name],
    ['量表 ID', data.scale.id],
    ['量表版本', data.scale.version],
    ['评估时间', data.assessedAt],
    ['导出时间', data.exportedAt],
    [],
    ['结果'],
    ['总分', String(data.result.totalScore)],
    ['结论', data.result.conclusion],
    ...(
      dimensionRows.length
        ? [['子领域得分', ''], ...dimensionRows.map((item) => [item.label, item.display])]
        : []
    ),
    ...(data.result.details?.description ? [['详细说明', data.result.details.description]] : []),
    [],
    ['答题明细'],
    ['题号', '题目', '作答', '分值'],
    ...data.answerDetails.map((item) => [
      String(item.questionId),
      item.questionText,
      item.answerLabel,
      item.answerScore === null ? '' : String(item.answerScore),
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, createFilename(data, 'csv'));
}

export function downloadDoctorAssessmentWord(data: DoctorAssessmentExportData) {
  const markup = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>单次评估结果报告</title>
      </head>
      <body>${createReportMarkup(data)}</body>
    </html>
  `;

  const blob = new Blob([markup], {
    type: 'application/msword',
  });
  triggerDownload(blob, createFilename(data, 'doc'));
}

export async function downloadDoctorAssessmentPdf(data: DoctorAssessmentExportData) {
  await exportMarkupToPdf(createReportMarkup(data), createFilename(data, 'pdf'));
}
