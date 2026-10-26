import type { Collection, SavedAnswer } from '../../shared/bookmark-types';

/**
 * ExportService - Generate and download collection exports in multiple formats
 */
class ExportServiceClass {
  /**
   * Export collection to Markdown format
   */
  exportToMarkdown(collection: Collection, answers: SavedAnswer[]): string {
    const date = this.formatDateReadable(collection.updatedAt);
    const count = answers.length;

    let md = `# Collection: ${collection.title}\n\n`;
    md += `**Exported:** ${date}  \n`;
    md += `**Answers:** ${count}\n\n`;
    md += `---\n\n`;

    answers.forEach((answer, index) => {
      md += `## Answer ${index + 1}: ${answer.title}\n\n`;
      md += `**Saved:** ${this.formatDateReadable(answer.savedAt)}  \n`;
      
      if (answer.conversationId) {
        const url = `https://chatgpt.com/c/${answer.conversationId}`;
        md += `**Source:** [Conversation](${url})\n\n`;
      } else {
        md += `**Source:** Unavailable\n\n`;
      }

      // Handle nested code fences
      const content = this.handleNestedCodeFences(answer.content);
      md += `${content}\n\n`;
      
      if (index < answers.length - 1) {
        md += `---\n\n`;
      }
    });

    return md;
  }

  /**
   * Export collection to JSON format
   */
  exportToJSON(collection: Collection, answers: SavedAnswer[]): string {
    const exportData = {
      collection: {
        title: collection.title,
        id: collection.id,
        exportedAt: new Date().toISOString(),
        answerCount: answers.length,
      },
      answers: answers.map((answer) => ({
        id: answer.id,
        title: answer.title,
        content: answer.content,
        savedAt: new Date(answer.savedAt).toISOString(),
        source: {
          conversationId: answer.conversationId || null,
          messageId: answer.messageId || null,
        },
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export collection to plain text format
   */
  exportToText(collection: Collection, answers: SavedAnswer[]): string {
    const date = this.formatDateReadable(collection.updatedAt);
    const count = answers.length;

    let txt = '========================================\n';
    txt += `Collection: ${collection.title}\n`;
    txt += '========================================\n\n';
    txt += `Exported: ${date}\n`;
    txt += `Answers: ${count}\n\n`;

    answers.forEach((answer, index) => {
      txt += '----------------------------------------\n\n';
      txt += `Answer ${index + 1}: ${answer.title}\n`;
      txt += `Saved: ${this.formatDateReadable(answer.savedAt)}\n`;
      
      if (answer.conversationId) {
        const url = `https://chatgpt.com/c/${answer.conversationId}`;
        txt += `Source: ${url}\n\n`;
      } else {
        txt += `Source: Unavailable\n\n`;
      }

      // Strip Markdown formatting for plain text
      const content = this.stripMarkdown(answer.content);
      txt += `${content}\n\n`;
    });

    return txt;
  }

  /**
   * Trigger browser download of content
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename from collection title and current date
   */
  generateFilename(collectionTitle: string, extension: string): string {
    const sanitized = this.sanitizeFilename(collectionTitle);
    const date = this.formatDateForFilename(Date.now());
    return `${sanitized}_export_${date}.${extension}`;
  }

  /**
   * Sanitize filename by removing special characters
   */
  private sanitizeFilename(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50); // Limit length
  }

  /**
   * Format date for filename (YYYY-MM-DD)
   */
  private formatDateForFilename(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format date for readable display
   */
  private formatDateReadable(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Handle nested code fences in Markdown content
   * If content contains triple backticks, use tildes instead
   */
  private handleNestedCodeFences(content: string): string {
    // Check if content contains triple backticks
    if (content.includes('```')) {
      // Replace existing triple backticks with triple tildes
      return content.replace(/```/g, '~~~');
    }
    return content;
  }

  /**
   * Strip basic Markdown formatting for plain text export
   */
  private stripMarkdown(content: string): string {
    return content
      .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, '')) // Remove code fence markers
      .replace(/`([^`]+)`/g, '$1') // Remove inline code markers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/#+\s+/g, '') // Remove heading markers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/^>\s+/gm, '') // Remove blockquote markers
      .replace(/^[-*+]\s+/gm, '• ') // Convert list markers to bullets
      .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
      .trim();
  }
}

// Export singleton instance
export const ExportService = new ExportServiceClass();
