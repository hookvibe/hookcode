import React from 'react';
import { clsx } from 'clsx';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Bug,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  Copy,
  FileText,
  Folder,
  FolderOpen,
  Gitlab,
  GitBranch,
  GitPullRequest,
  Globe,
  Hourglass,
  Info,
  Key,
  Link,
  List,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Pause,
  PlayCircle,
  Plug,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Server,
  Settings,
  Trash2,
  User,
  Wrench,
  X,
  XCircle,
  Zap
} from 'lucide-react';

export type IconProps = React.SVGProps<SVGSVGElement> & { spin?: boolean };

const withLucide = (IconComp: React.FC<React.SVGProps<SVGSVGElement>>) =>
  function Icon({ className, spin, width, height, ...rest }: IconProps) {
    const size = typeof width === 'number' || typeof width === 'string' ? width : 16;
    return (
      <IconComp
        className={clsx('hc-icon', spin && 'hc-icon-spin', className)}
        width={size}
        height={height ?? size}
        {...rest}
      />
    );
  };

// Map legacy UI icon names to Lucide equivalents for the custom UI kit. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const BugOutlined = withLucide(Bug);
export const CheckCircleFilled = withLucide(CheckCircle2);
export const CloseCircleFilled = withLucide(XCircle);
export const CodeOutlined = withLucide(Code);
export const RightOutlined = withLucide(ChevronRight);
export const LeftOutlined = withLucide(ChevronLeft);
export const FileTextOutlined = withLucide(FileText);
export const HourglassOutlined = withLucide(Hourglass);
export const LoadingOutlined = withLucide(Loader2);
export const MessageOutlined = withLucide(MessageSquare);
export const MenuFoldOutlined = withLucide(ChevronLeft);
export const MenuUnfoldOutlined = withLucide(ChevronRight);
export const PlusOutlined = withLucide(Plus);
export const ProjectOutlined = withLucide(Folder);
export const PullRequestOutlined = withLucide(GitPullRequest);
export const UnorderedListOutlined = withLucide(List);
export const EllipsisOutlined = withLucide(MoreHorizontal);
export const CaretRightOutlined = withLucide(ChevronRight);
export const CaretDownOutlined = withLucide(ChevronDown);
export const InboxOutlined = withLucide(Archive);
export const PlayCircleOutlined = withLucide(PlayCircle);
export const ReloadOutlined = withLucide(RefreshCcw);
export const SearchOutlined = withLucide(Search);
export const ClockCircleOutlined = withLucide(Clock);
export const SendOutlined = withLucide(Send);
export const FolderOpenOutlined = withLucide(FolderOpen);
export const LockOutlined = withLucide(Lock);
export const SettingOutlined = withLucide(Settings);
export const UserOutlined = withLucide(User);
export const GlobalOutlined = withLucide(Globe);
export const KeyOutlined = withLucide(Key);
export const LinkOutlined = withLucide(Link);
export const LogoutOutlined = withLucide(LogOut);
export const ToolOutlined = withLucide(Wrench);
export const CloudServerOutlined = withLucide(Server);
export const CloseOutlined = withLucide(X);
export const CheckSquareOutlined = withLucide(CheckSquare);
export const MoreOutlined = withLucide(MoreHorizontal);
// Add missing brand/help icons used in task detail pages. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
export const GitlabOutlined = withLucide(Gitlab);
export const InfoCircleOutlined = withLucide(Info);
export const CopyOutlined = withLucide(Copy);
export const DeleteOutlined = withLucide(Trash2);
export const PauseOutlined = withLucide(Pause);
export const BarChartOutlined = withLucide(BarChart3);
export const ApiOutlined = withLucide(Plug);
export const BranchesOutlined = withLucide(GitBranch);
export const RobotOutlined = withLucide(Bot);
export const ThunderboltOutlined = withLucide(Zap);
export const ArrowLeftOutlined = withLucide(ArrowLeft);
export const ArrowRightOutlined = withLucide(ArrowRight);
export const CheckOutlined = withLucide(Check);
export const SaveOutlined = withLucide(Save);
