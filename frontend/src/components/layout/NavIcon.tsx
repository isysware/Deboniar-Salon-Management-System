import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Award,
  Clock,
  FileText,
  Calendar,
  Users,
  Timer,
  Scissors,
  Package,
  UserCheck,
  CreditCard,
  BadgeDollarSign,
  PieChart,
  Coins,
  BookOpen,
  Scale,
  ArrowRightLeft,
  BarChart3,
  FileSpreadsheet,
  AlertCircle,
  Landmark,
  Wallet,
  ListOrdered,
  Banknote,
  Percent,
  Sparkles,
  Boxes,
  CalendarCheck,
  History,
  Building2,
  ShieldCheck,
  Sliders,
  ShieldAlert,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';

interface NavIconProps {
  name: string;
  className?: string;
}

export const NavIcon: React.FC<NavIconProps> = ({ name, className = 'w-4 h-4' }) => {
  switch (name) {
    case 'LayoutDashboard':
      return <LayoutDashboard className={className} />;
    case 'Receipt':
      return <Receipt className={className} />;
    case 'TrendingUp':
      return <TrendingUp className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Clock':
    case 'ClockAlert':
    case 'Clock3':
      return <Clock className={className} />;
    case 'FileText':
      return <FileText className={className} />;
    case 'Calendar':
      return <Calendar className={className} />;
    case 'Users':
      return <Users className={className} />;
    case 'Timer':
      return <Timer className={className} />;
    case 'Scissors':
      return <Scissors className={className} />;
    case 'Package':
      return <Package className={className} />;
    case 'UserCheck':
      return <UserCheck className={className} />;
    case 'CreditCard':
      return <CreditCard className={className} />;
    case 'BadgeDollarSign':
      return <BadgeDollarSign className={className} />;
    case 'PieChart':
      return <PieChart className={className} />;
    case 'Coins':
      return <Coins className={className} />;
    case 'BookOpen':
      return <BookOpen className={className} />;
    case 'Scale':
      return <Scale className={className} />;
    case 'ArrowRightLeft':
      return <ArrowRightLeft className={className} />;
    case 'BarChart3':
      return <BarChart3 className={className} />;
    case 'FileSpreadsheet':
      return <FileSpreadsheet className={className} />;
    case 'AlertCircle':
      return <AlertCircle className={className} />;
    case 'Landmark':
      return <Landmark className={className} />;
    case 'Wallet':
      return <Wallet className={className} />;
    case 'ListOrdered':
      return <ListOrdered className={className} />;
    case 'Banknote':
      return <Banknote className={className} />;
    case 'Percent':
      return <Percent className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Boxes':
      return <Boxes className={className} />;
    case 'CalendarCheck':
      return <CalendarCheck className={className} />;
    case 'History':
      return <History className={className} />;
    case 'Building2':
      return <Building2 className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Sliders':
      return <Sliders className={className} />;
    case 'ShieldAlert':
      return <ShieldAlert className={className} />;
    case 'RotateCcw':
      return <RotateCcw className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
};
