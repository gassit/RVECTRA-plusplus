'use client';

import { Card, CardContent } from '@/components/ui/card';
import { 
  Zap, 
  Box, 
  Lightbulb, 
  Power, 
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: 'source' | 'cabinet' | 'load' | 'breaker' | 'alert' | 'total';
  description?: string;
  trend?: number;
}

const ICONS = {
  source: Zap,
  cabinet: Box,
  load: Lightbulb,
  breaker: Power,
  alert: AlertTriangle,
  total: TrendingUp,
};

const COLORS = {
  source: 'bg-emerald-100 text-emerald-600',
  cabinet: 'bg-blue-100 text-blue-600',
  load: 'bg-orange-100 text-orange-600',
  breaker: 'bg-slate-100 text-slate-600',
  alert: 'bg-red-100 text-red-600',
  total: 'bg-purple-100 text-purple-600',
};

export default function StatsCard({ title, value, icon, description, trend }: StatsCardProps) {
  const Icon = ICONS[icon];
  const colorClass = COLORS[icon];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`text-xs mt-2 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% от прошлой проверки
          </div>
        )}
      </CardContent>
    </Card>
  );
}
