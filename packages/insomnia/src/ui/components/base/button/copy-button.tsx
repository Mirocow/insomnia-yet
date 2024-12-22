import React, { type FC, useCallback, useState } from 'react';
import { useInterval } from 'react-use';

import { Button, type ButtonProps } from './button';

export interface CopyButtonProps extends ButtonProps {
  confirmMessage?: string;
  content: string;
  title?: string;
}

export const CopyButton: FC<CopyButtonProps> = ({
  children,
  confirmMessage,
  content,
  title,
  ...buttonProps
}) => {
  const [showConfirmation, setshowConfirmation] = useState(false);
  const onClick = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (content) {
      window.clipboard.writeText(content);
    }
    setshowConfirmation(true);
  }, [content]);

  useInterval(() => {
    setshowConfirmation(false);
  }, 2000);

  const confirm = typeof confirmMessage === 'string' ? confirmMessage : 'Copied';
  return (
    <Button
      {...buttonProps}
      title={title}
      onClick={onClick}
    >
      {showConfirmation ? (
        <span>
          {confirm} <i className="fa fa-check-circle-o" />
        </span>
      ) : (
        children || 'Copy to Clipboard'
      )}
    </Button>
  );
};
