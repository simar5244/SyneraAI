// This file provides a single source of truth for all icon imports
// to avoid issues with tree-shaking and optimize bundle size

// Feather Icons
// Individual icon imports from react-feather
import { AlertTriangle } from 'react-feather';
import { ArrowLeft } from 'react-feather';
import { X as Ban } from 'react-feather';
import { Download } from 'react-feather';
import { Edit } from 'react-feather';
import { Mail } from 'react-feather';
import { LogOut } from 'react-feather';
import { RefreshCw } from 'react-feather';
import { Settings } from 'react-feather';
import { Trash2 } from 'react-feather';
import { X } from 'react-feather';

// Re-export with consistent naming
export const FiAlertTriangle = AlertTriangle;
export const FiArrowLeft = ArrowLeft;
export const FiBan = Ban;
export const FiDownload = Download;
export const FiEdit = Edit;
export const FiMail = Mail;
export const FiLogOut = LogOut;
export const FiRefreshCw = RefreshCw;
export const FiSettings = Settings;
export const FiTrash2 = Trash2;
export const FiTimes = X;

// Material-UI Icons
export { default as AssignmentOutline } from '@mui/icons-material/AssignmentOutlined';
export { default as Business } from '@mui/icons-material/Business';
export { default as CalendarToday } from '@mui/icons-material/CalendarToday';
export { default as CheckCircleOutline } from '@mui/icons-material/CheckCircleOutline';
export { default as Close } from '@mui/icons-material/Close';
export { default as DeleteOutline } from '@mui/icons-material/DeleteOutline';
export { default as PersonOutline } from '@mui/icons-material/PersonOutline';
export { default as WarningAmber } from '@mui/icons-material/WarningAmber';
export { default as WorkOutline } from '@mui/icons-material/WorkOutline';
