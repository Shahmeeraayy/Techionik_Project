import type { CSSProperties, ElementType } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type OverflowTextProps = {
    text?: string | null;
    className?: string;
    tooltipClassName?: string;
    lines?: 1 | 2 | 3;
    as?: ElementType;
};

export default function OverflowText({
    text,
    className,
    tooltipClassName,
    lines = 1,
    as: Component = 'span',
}: OverflowTextProps) {
    const content = text?.trim() || '-';
    const isInlineElement = Component === 'span';
    const clampStyle: CSSProperties | undefined =
        lines > 1
            ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: lines,
                overflow: 'hidden',
            }
            : undefined;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Component
                    title={content}
                    className={cn(
                        'min-w-0',
                        lines === 1
                            ? isInlineElement
                                ? 'inline-block max-w-full truncate align-bottom'
                                : 'block truncate'
                            : 'block break-words',
                        className,
                    )}
                    style={clampStyle}
                >
                    {content}
                </Component>
            </TooltipTrigger>
            <TooltipContent sideOffset={6} className={cn('max-w-[28rem] whitespace-pre-wrap break-words', tooltipClassName)}>
                {content}
            </TooltipContent>
        </Tooltip>
    );
}
