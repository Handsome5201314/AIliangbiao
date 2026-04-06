/**
 * 评估结果导出工具
 * 支持表格（CSV/Excel）、PDF、图片导出
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface AssessmentExportData {
  scaleId: string;
  scaleName: string;
  totalScore: number;
  conclusion: string;
  details?: {
    description?: string;
    [key: string]: unknown;
  };
  answers: number[];
  childProfile?: {
    nickname: string;
    gender: string;
    ageMonths?: number;
  };
  completedAt: string;
  advice?: string;
}

/**
 * 导出为 CSV 格式
 */
export function exportToCSV(data: AssessmentExportData): void {
  const rows: string[][] = [];

  // 标题行
  rows.push(['评估报告']);
  rows.push([]);

  // 基本信息
  rows.push(['评估信息']);
  rows.push(['量表名称', data.scaleName]);
  rows.push(['评估日期', data.completedAt]);
  rows.push([]);

  // 儿童信息
  if (data.childProfile) {
    rows.push(['儿童信息']);
    rows.push(['姓名', data.childProfile.nickname]);
    rows.push(['性别', data.childProfile.gender === 'boy' ? '男孩' : '女孩']);
    if (data.childProfile.ageMonths) {
      rows.push(['月龄', `${data.childProfile.ageMonths}个月`]);
    }
    rows.push([]);
  }

  // 评估结果
  rows.push(['评估结果']);
  rows.push(['总分', data.totalScore.toString()]);
  rows.push(['评估结论', data.conclusion]);
  if (data.details?.description) {
    rows.push(['详细说明', data.details.description]);
  }
  rows.push([]);

  // 答题明细
  rows.push(['答题明细']);
  data.answers.forEach((answer, index) => {
    rows.push([`题目 ${index + 1}`, answer.toString()]);
  });

  // AI 建议
  if (data.advice) {
    rows.push([]);
    rows.push(['AI 个性化建议']);
    rows.push([data.advice]);
  }

  // 注意事项
  rows.push([]);
  rows.push(['注意事项']);
  rows.push(['本评估结果仅供参考，不能替代专业医疗诊断']);
  rows.push(['如有疑虑，请咨询专业医生或心理评估师']);

  // 转换为 CSV 字符串
  const csvContent = rows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  // 添加 BOM 以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `评估报告_${data.scaleName}_${data.childProfile?.nickname || '游客'}_${formatDate(new Date())}.csv`);
}

/**
 * 导出为图片
 */
export async function exportToImage(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('找不到要导出的元素');
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // 高清
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    canvas.toBlob((blob) => {
      if (blob) {
        downloadBlob(blob, `${filename}.png`);
      }
    }, 'image/png');
  } catch (error) {
    console.error('导出图片失败:', error);
    throw new Error('导出图片失败');
  }
}

/**
 * 导出为 PDF
 */
export async function exportToPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('找不到要导出的元素');
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // A4 纸尺寸 (mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // 计算缩放比例
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const scaledWidth = imgWidth * ratio;
    const scaledHeight = imgHeight * ratio;

    // 居中放置
    const x = (pdfWidth - scaledWidth) / 2;
    const y = 10;

    // 如果内容超过一页，分页
    if (scaledHeight > pdfHeight - 20) {
      const pageCount = Math.ceil(scaledHeight / (pdfHeight - 20));
      let currentPosition = 0;

      for (let i = 0; i < pageCount; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const sourceY = i * (pdfHeight - 20) / ratio;
        const sourceHeight = Math.min((pdfHeight - 20) / ratio, imgHeight - sourceY);

        // 创建临时 canvas 用于裁剪
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = sourceHeight;
        const ctx = tempCanvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(
            canvas,
            0, sourceY, imgWidth, sourceHeight,
            0, 0, imgWidth, sourceHeight
          );
          
          const pageImgData = tempCanvas.toDataURL('image/png');
          const pageHeight = sourceHeight * ratio;
          
          pdf.addImage(pageImgData, 'PNG', x, y, scaledWidth, pageHeight);
        }
      }
    } else {
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('导出PDF失败:', error);
    throw new Error('导出PDF失败');
  }
}

/**
 * 下载 Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 格式化日期
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
