'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ValidationIssue } from '@/types';

interface ValidationPanelProps {
  issues: ValidationIssue[];
  onValidate: () => void;
  isValidating: boolean;
  stats: {
    critical: number;
    fail: number;
    warn: number;
  };
  compact?: boolean;
}

const severityConfig = {
  CRITICAL: { 
    icon: XCircle, 
    bg: 'bg-red-50 dark:bg-red-900/30', 
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-500',
    label: 'КРИТИЧНО' 
  },
  FAIL: { 
    icon: AlertCircle, 
    bg: 'bg-orange-50 dark:bg-orange-900/30', 
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-400',
    badge: 'bg-orange-500',
    label: 'ОШИБКА' 
  },
  WARN: { 
    icon: AlertTriangle, 
    bg: 'bg-yellow-50 dark:bg-yellow-900/30', 
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-400',
    badge: 'bg-yellow-500',
    label: 'ВНИМАНИЕ' 
  },
};

export default function ValidationPanel({ 
  issues, 
  onValidate, 
  isValidating, 
  stats,
  compact = false,
}: ValidationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalIssues = stats.critical + stats.fail + stats.warn;
  const criticalIssues = issues.filter(i => i.severity === 'CRITICAL').slice(0, 3);

  if (compact) {
    return (
      <Card className="shadow-lg border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur">
        <CardContent className="p-3">
          {/* Заголовок */}
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded ${stats.critical > 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-orange-100 dark:bg-orange-900'}`}>
                <AlertCircle className={`h-4 w-4 ${stats.critical > 0 ? 'text-red-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {stats.critical > 0 ? 'Критические проблемы' : 'Проблемы сети'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {totalIssues} {totalIssues === 1 ? 'проблема' : totalIssues < 5 ? 'проблемы' : 'проблем'}
                </div>
              </div>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Развёрнутый список */}
          {isExpanded && (
            <div className="mt-2 space-y-1.5">
              {criticalIssues.map((issue, idx) => (
                <div 
                  key={idx}
                  className={`p-2 rounded text-xs ${severityConfig[issue.severity]?.bg || 'bg-slate-50'}`}
                >
                  <div className="flex items-start gap-1.5">
                    <span className={`font-medium ${severityConfig[issue.severity]?.text || 'text-slate-600'}`}>
                      {issue.elementName || issue.message?.split(' ')[0]}:
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 flex-1">
                      {issue.message?.slice(0, 60)}...
                    </span>
                  </div>
                </div>
              ))}

              {totalIssues > 3 && (
                <div className="text-xs text-center text-muted-foreground pt-1">
                  +{totalIssues - 3} других
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={onValidate}
                disabled={isValidating}
                className="w-full mt-2 h-7 text-xs"
              >
                {isValidating ? 'Проверка...' : 'Перепроверить'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Полный вид (не используется в новом дизайне, но оставлен для совместимости)
  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Мини-статистика */}
          <div className="flex gap-2">
            {stats.critical > 0 && (
              <Badge variant="destructive" className="text-xs">
                {stats.critical} крит.
              </Badge>
            )}
            {stats.fail > 0 && (
              <Badge className="bg-orange-500 text-xs">
                {stats.fail} ошибок
              </Badge>
            )}
            {stats.warn > 0 && (
              <Badge className="bg-yellow-500 text-black text-xs">
                {stats.warn} предупреждений
              </Badge>
            )}
          </div>

          {/* Кнопка */}
          <Button
            size="sm"
            onClick={onValidate}
            disabled={isValidating}
            className="w-full"
          >
            {isValidating ? 'Проверка...' : 'Проверить сеть'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
