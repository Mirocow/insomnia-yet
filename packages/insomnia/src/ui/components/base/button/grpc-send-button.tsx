import React, { type FunctionComponent } from 'react';

import type { GrpcMethodType } from '../../../../main/ipc/grpc';
import { Button, ButtonProps } from './button';

export interface GrpcSendButtonProps {
  running: boolean;
  methodType?: GrpcMethodType;
  handleStart: () => Promise<void>;
  handleCancel: () => void;
}

const buttonProps: ButtonProps = {
  className: 'tall',
  bg: 'surprise',
  size: 'medium',
  variant: 'contained',
  radius: '0',
};

export const GrpcSendButton: FunctionComponent<GrpcSendButtonProps> = ({ running, methodType, handleStart, handleCancel }) => {
  if (running) {
    return (
      <Button {...buttonProps} onClick={handleCancel}>
        Cancel
      </Button>
    );
  }

  if (!methodType) {
    return (
      <Button {...buttonProps} disabled>
        Send
      </Button>
    );
  }

  return (
    <Button {...buttonProps} onClick={handleStart}>
      {methodType === 'unary' ? 'Send' : 'Start'}
    </Button>
  );
};
