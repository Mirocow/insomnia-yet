import { library } from '@fortawesome/fontawesome-svg-core';
import { fab as brands } from '@fortawesome/free-brands-svg-icons';
import { far as regular } from '@fortawesome/free-regular-svg-icons';
import { fas as solid } from '@fortawesome/free-solid-svg-icons';
import {
  FontAwesomeIcon,
  type FontAwesomeIconProps,
} from '@fortawesome/react-fontawesome';
import React from 'react';

library.add(brands, regular, solid);

export const Icon = (props: FontAwesomeIconProps) => (
  <FontAwesomeIcon {...props} />
);
