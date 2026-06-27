import React from 'react';

export interface QuestionCardProps {
  questionNumber: number;
  questionText: string;
  animationKey: string;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  questionNumber,
  questionText,
  animationKey,
}) => {
  return (
    <div
      key={animationKey}
      className="question-enter bg-white rounded-card shadow-sm p-6"
    >
      {/* Question number badge */}
      <span className="inline-block bg-sage-50 text-sage-600 text-xs font-medium px-3 py-1 rounded-pill mb-4">
        第 {questionNumber} 题
      </span>

      {/* Question text */}
      <p className="text-base leading-relaxed text-foreground">
        {questionText}
      </p>
    </div>
  );
};

export default QuestionCard;
