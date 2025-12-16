import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Image, Pressable } from 'react-native';
import { GraphConfig, GraphResult } from '../../services/sessionGraphEngine';

interface Props {
  config: GraphConfig;
  result: GraphResult;
  members?: Array<{ id: string; image?: string; name: string }>;
  fullscreen?: boolean;
  onRequestFullscreen?: () => void;
  onExport?: (type: 'png' | 'jpg' | 'pdf') => void;
  currency?: string;
  penaltyName?: string;
  timeFormat?: string;
  timezone?: string;
  clubMaxMultiplier?: number;
  titleOffset?: number; // vertical space consumed by fullscreen top bar
}

const DUMMY_IMAGE = require('../../../assets/images/dummy/default-member.png');
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

/**
 * Format tooltip timestamp according to club's timezone and timeFormat settings
 * @param timestamp - Unix timestamp in milliseconds
 * @param timezone - IANA timezone (e.g., "Europe/Paris" for CET, "UTC")
 * @param timeFormat - Display format (e.g., "HH:mm", "h:mm a", "HH:mm:ss")
 * @returns Formatted time string
 */
function formatTooltipTime(timestamp: number, timezone: string, timeFormat: string): string {
  try {
    const date = new Date(timestamp);
    
    // Map common timezone names to IANA format
    const timezoneMap: Record<string, string> = {
      'CET': 'Europe/Paris', // Central European Time
      'UTC': 'UTC',
      'EST': 'America/New_York',
      'PST': 'America/Los_Angeles',
      'Asia/Kolkata': 'Asia/Kolkata',
    };
    
    const ianaTimezone = timezoneMap[timezone] || timezone || 'UTC';
    
    // Format based on timeFormat preference
    if (timeFormat === 'h:mm a' || timeFormat.includes('a')) {
      // 12-hour format with AM/PM
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
        timeZone: ianaTimezone 
      });
    } else if (timeFormat === 'HH:mm:ss') {
      // 24-hour format with seconds
      return date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: ianaTimezone 
      });
    } else {
      // Default: 24-hour format without seconds (HH:mm)
      return date.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: ianaTimezone 
      });
    }
  } catch (error) {
    // Fallback if timezone conversion fails
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Interpolate color from light orange to red based on multiplier value
 * @param multiplier - Current multiplier value
 * @param maxMultiplier - Maximum multiplier for the club
 * @returns Hex color string
 */
function getMultiplierBandColor(multiplier: number, maxMultiplier: number): string {
  if (multiplier <= 1) {
    return '#ffffff'; // No color for 1x multiplier
  }
  
  const maxMult = Math.max(maxMultiplier, 2);
  const ratio = Math.min((multiplier - 1) / (maxMult - 1), 1); // Clamp to [0, 1]
  
  // Light orange to red gradient
  const startR = 255, startG = 169, startB = 77;   // #FFA94D (light orange)
  const endR = 224, endG = 49, endB = 49;          // #E03131 (red)
  
  const r = Math.round(startR + (endR - startR) * ratio);
  const g = Math.round(startG + (endG - startG) * ratio);
  const b = Math.round(startB + (endB - startB) * ratio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}



export default function SessionGraphView({ config, result, members = [], fullscreen = false, onRequestFullscreen, onExport, currency, penaltyName, timeFormat = 'HH:mm', timezone = 'UTC', clubMaxMultiplier = 10, titleOffset = 0 }: Props) {
  const [dimensions, setDimensions] = useState(() => ({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  }));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  const isPortrait = screenHeight >= screenWidth;
  const [legendHeight, setLegendHeight] = useState(0);
  const chartWidth = fullscreen ? screenWidth : Math.max(screenWidth - 32, 300);

  // Portrait fullscreen: reserve clean space for legend and avoid overlap while keeping the graph dominant
  const portraitGraphHeight = Math.min(
    Math.max(screenHeight * 0.72, screenHeight - 160),
    screenHeight * 0.86,
  );

  const reservedLegend = fullscreen ? legendHeight + (isPortrait ? 4 : 4) : 0;
  const reservedXAxis = fullscreen ? (isPortrait ? 52 : 56) : 30; // ensure X-axis always has space

  const availableHeight = fullscreen
    ? Math.max(screenHeight - reservedLegend - titleOffset - 8, 240)
    : 300;

  const chartHeight = fullscreen
    ? Math.max(
        220,
        Math.min(
          isPortrait ? portraitGraphHeight : screenHeight - 32,
          availableHeight - reservedXAxis - 4,
        ),
      )
    : 300;

  const padding = fullscreen
    ? { left: 50, right: 16, top: isPortrait ? 6 : 6, bottom: reservedXAxis }
    : { left: 40, right: 20, top: 20, bottom: 30 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;
  const containerRef = useRef<View>(null);

  const { minX, maxX, minY, maxY, yAxisStart, dataMaxY, isAmountMode } = useMemo(() => {
    // X-axis range: 0 to sessionEnd exactly (no padding beyond session)
    const endAbs = result.sessionEnd ?? Math.max(result.sessionStart, ...result.series.flatMap(s => s.points.map(p => result.sessionStart + p.x)));
    const spanMs = Math.max(5 * 60 * 1000, endAbs - result.sessionStart);
    const baseMaxX = spanMs; // Exact session span

    let maxY = 0;
    result.series.forEach(s => s.points.forEach(p => { maxY = Math.max(maxY, p.y); }));

    const yAxisStart = 0;
    const yPad = Math.max(0, (maxY - yAxisStart) * 0.05);
    const paddedMaxY = maxY + yPad;
    const isAmountMode = config.mode === 'total-amount-per-player' || config.mode === 'full-replay';
    return { minX: 0, maxX: baseMaxX, minY: yAxisStart, maxY: Math.max(yAxisStart + 1, paddedMaxY), yAxisStart, dataMaxY: maxY, isAmountMode };
  }, [result, config.mode]);

  const memberMap = useMemo(() => {
    const map: Record<string, { id: string; image?: string; name: string }> = {};
    members.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const safeDenomX = Math.max(1, maxX - minX);
  const safeDenomY = Math.max(1, maxY - minY);
  const xScale = (x: number) => ((x - minX) / safeDenomX) * graphWidth + padding.left;
  const yScale = (y: number) => chartHeight - padding.bottom - ((y - minY) / safeDenomY) * graphHeight;

  // X-axis labels with even spacing (5-min or larger nice interval), ensuring final tick at session end
  const xTicks = useMemo(() => {
    const startAbs = result.sessionStart;
    const endAbs = result.sessionEnd ?? Math.max(startAbs, ...result.series.flatMap(s => s.points.map(p => startAbs + p.x)));
    const spanMs = Math.max(5 * 60 * 1000, endAbs - startAbs);
    const candidates = [5, 10, 15, 30, 60, 120]; // minutes
    let stepMin = 5;
    for (const c of candidates) {
      const ticks = Math.ceil(spanMs / (c * 60 * 1000)) + 1;
      if (ticks <= 20) { stepMin = c; break; }
    }
    const stepMs = stepMin * 60 * 1000;
    const labels: { x: number; text: string }[] = [];
    let t = startAbs;
    while (t <= endAbs) {
      const rel = t - startAbs;
      const d = new Date(t);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      let formatted = `${hh}:${mm}`;
      if (timeFormat.includes('ss')) formatted = `${hh}:${mm}:${ss}`;
      if (timeFormat.includes('a') || timeFormat.includes('A')) {
        const hour = d.getHours();
        const h12 = hour % 12 || 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        formatted = `${h12}:${mm} ${ampm}`;
      }
      labels.push({ x: rel, text: formatted });
      t += stepMs;
    }
    // Ensure final tick at session end
    const finalRel = endAbs - startAbs;
    if (labels.length === 0 || labels[labels.length - 1].x < finalRel) {
      const d = new Date(endAbs);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      let formatted = `${hh}:${mm}`;
      if (timeFormat.includes('ss')) formatted = `${hh}:${mm}:${ss}`;
      if (timeFormat.includes('a') || timeFormat.includes('A')) {
        const hour = d.getHours();
        const h12 = hour % 12 || 12;
        const ampm = hour < 12 ? 'AM' : 'PM';
        formatted = `${h12}:${mm} ${ampm}`;
      }
      labels.push({ x: finalRel, text: formatted });
    }
    return labels;
  }, [result.sessionStart, result.sessionEnd, result.series, timeFormat]);

  // Y-axis ticks (integers for all modes, start at zero; amounts use even steps)
  const yTicks = useMemo(() => {
    const maxVal = Math.max(0, Math.ceil(dataMaxY));
    const tickCount = 5;
    const rawStep = Math.max(1, Math.ceil(maxVal / tickCount));
    const step = isAmountMode ? Math.max(1, Math.round(rawStep / 5) * 5) : rawStep; // amounts: 0,5,10...
    const ticks: number[] = [0];
    for (let v = step; v <= maxVal + step * 0.1; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < maxVal) ticks.push(maxVal);
    return ticks;
  }, [dataMaxY, isAmountMode]);

  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: any; seriesColor: string } | null>(null);

  return (
    <View
      ref={containerRef}
      style={[
        styles.chartContainer,
        fullscreen && {
          flex: 1,
          paddingHorizontal: 0,
          paddingVertical: isPortrait ? 8 : 0,
          justifyContent: 'flex-start',
        },
      ]}
    >
      {!fullscreen && (
        <View style={styles.headerRow}>
          <Text style={styles.chartTitle}>{penaltyName || config.mode}</Text>
          <View style={styles.headerActions}>
            {onRequestFullscreen && (
              <Pressable accessibilityRole="button" onPress={onRequestFullscreen} style={styles.actionBtn}>
                <Text style={styles.actionText}>Fullscreen</Text>
              </Pressable>
            )}
            {onExport && (
              <>
                <Pressable accessibilityRole="button" onPress={() => onExport('png')} style={styles.actionBtn}>
                  <Text style={styles.actionText}>PNG</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => onExport('jpg')} style={styles.actionBtn}>
                  <Text style={styles.actionText}>JPEG</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => onExport('pdf')} style={styles.actionBtn}>
                  <Text style={styles.actionText}>PDF</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
            {/* Inline title removed to avoid duplication with new top bar */}
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
            const y = padding.top + frac * graphHeight;
            return (
              <View
                key={`hline-${i}`}
                style={[
                  styles.gridLine,
                  { top: y, left: padding.left, width: graphWidth },
                ]}
              />
            );
          })}

          {/* Multiplier bands */}
          {config.showMultiplierBands &&
            result.bands.map((band, idx) => {
              const x = xScale(band.startX);
              const w = xScale(band.endX) - x;
              const bandColor = getMultiplierBandColor(band.multiplier, clubMaxMultiplier);
              const opacity = Math.min(0.15 + band.multiplier * 0.06, 0.35);
              return (
                <View
                  key={`band-${idx}`}
                  style={[
                    styles.band,
                    {
                      left: x,
                      top: padding.top,
                      width: w,
                      height: graphHeight,
                      opacity,
                      backgroundColor: bandColor,
                    },
                  ]}
                />
              );
            })}

          {/* Lines and points */}
          {result.series.map((series, sIdx) => {
            const color = COLORS[sIdx % COLORS.length];
            return (
              <View key={`series-${sIdx}`}>
                {/* Step-wise line segments: horizontal then vertical jumps at commit timestamps */}
                {series.points.slice(0, -1).map((p, i) => {
                  const p2 = series.points[i + 1];
                  const x1 = xScale(p.x);
                  const y1 = yScale(p.y);
                  const x2 = xScale(p2.x);
                  const y2 = yScale(p2.y);
                  const horizontalWidth = x2 - x1;
                  const verticalHeight = y2 - y1;
                  return (
                    <React.Fragment key={`line-${i}`}>
                      <View
                        style={{
                          position: 'absolute',
                          left: x1,
                          top: y1,
                          width: horizontalWidth,
                          height: 2,
                          backgroundColor: color,
                        }}
                      />
                      <View
                        style={{
                          position: 'absolute',
                          left: x2,
                          top: verticalHeight >= 0 ? y1 : y2,
                          width: 2,
                          height: Math.abs(verticalHeight),
                          backgroundColor: color,
                        }}
                      />
                    </React.Fragment>
                  );
                })}
                {/* Points with member images */}
                {series.points.map((p, pIdx) => {
                  const member = p.memberId ? memberMap[p.memberId] : null;
                  const imageUri = member?.image || DUMMY_IMAGE;

                  return (
                    <Pressable
                      key={`point-${pIdx}`}
                      style={[
                        styles.dataPoint,
                        {
                          left: xScale(p.x) - 12,
                          top: yScale(p.y) - 12,
                        },
                      ]}
                      onPress={() => setTooltip({ x: xScale(p.x), y: yScale(p.y), point: p, seriesColor: color })}
                    >
                      {/* Colored background circle */}
                      <View
                        style={[
                          styles.pointCircle,
                          { backgroundColor: color, borderColor: '#fff', borderWidth: 2 },
                        ]}
                      />
                      {/* Member image */}
                      <Image
                        source={typeof imageUri === 'string' ? { uri: imageUri } : imageUri}
                        style={styles.memberImage}
                      />
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          {/* Axes */}
          <View
            style={[
              styles.axis,
              {
                left: padding.left,
                top: padding.top,
                height: graphHeight,
                width: 2,
              },
            ]}
          />
          <View
            style={[
              styles.axis,
              {
                left: padding.left,
                top: chartHeight - padding.bottom - 1,
                width: graphWidth,
                height: 2,
              },
            ]}
          />

          {/* Y-axis labels (append currency for amount graphs) */}
          {yTicks.map((val, i) => {
            const y = yScale(val);
            return (
              <Text
                key={`ylabel-${i}`}
                style={[styles.axisLabel, { left: 5, top: y - 8 }]}
              >
                {isAmountMode && currency ? `${val} ${currency}` : `${val}`}
              </Text>
            );
          })}

          {/* X-axis time labels - even spacing across full session */}
          {xTicks.map((lbl, i) => {
            const rawX = xScale(lbl.x);
            const x = Math.min(chartWidth - padding.right - 30, Math.max(padding.left, rawX - 16));
            return (
              <Text
                key={`xlabel-${i}`}
                style={[styles.axisLabel, { left: x, top: chartHeight - padding.bottom + 5 }]}
                numberOfLines={1}
              >
                {lbl.text}
              </Text>
            );
          })}
        </View>
      </ScrollView>

      {/* Legend */}
      <View
        style={[
          styles.legend,
          fullscreen && (isPortrait ? styles.legendPortrait : styles.legendFullscreen),
          fullscreen && { marginTop: 4 },
        ]}
        onLayout={e => setLegendHeight(e.nativeEvent.layout.height)}
      >
        {result.series.map((s, idx) => (
          <View key={s.id} style={[styles.legendItem, fullscreen && styles.legendItemFullscreen]}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: COLORS[idx % COLORS.length] },
                fullscreen && { width: 16, height: 16 },
              ]}
            />
            <Text style={[styles.legendLabel, fullscreen && { fontSize: 14 }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {tooltip && (
        <Pressable style={styles.tooltipOverlay} onPress={() => setTooltip(null)}>
          <View style={[styles.tooltipCard, { left: Math.max(8, Math.min(tooltip.x, chartWidth - 200)), top: Math.max(8, tooltip.y - 120) }]}>
            <View style={styles.tooltipMemberCenter}>
              <Image
                source={tooltip.point.memberId && memberMap[tooltip.point.memberId]?.image ? { uri: memberMap[tooltip.point.memberId].image } : DUMMY_IMAGE}
                style={styles.tooltipMemberImage}
              />
              <Text style={styles.tooltipMemberName}>{tooltip.point.memberName || 'Member'}</Text>
            </View>

            <Text style={styles.tooltipTimestamp}>
              {formatTooltipTime(tooltip.point.timestamp ?? (result.sessionStart + (tooltip.point.x ?? 0)), timezone, timeFormat)}
            </Text>
            <Text style={styles.tooltipLabel}>{tooltip.point.penaltyName || 'Penalty'}</Text>
            {tooltip.point.multiplier && tooltip.point.multiplier > 1 ? (
              <Text style={styles.tooltipLabel}>Multiplier: x{tooltip.point.multiplier}</Text>
            ) : null}
            <Text style={styles.tooltipAmount}>Amount Total: {tooltip.point.amountTotal ?? tooltip.point.amountApplied ?? tooltip.point.y}</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: { paddingVertical: 12, paddingHorizontal: 16 },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  chart: {
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  band: {
    position: 'absolute',
    backgroundColor: '#fb923c',
  },
  dataPoint: {
    position: 'absolute',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointCircle: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  memberImage: {
    width: 18,
    height: 18,
    borderRadius: 9,
    position: 'absolute',
  },
  point: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  axis: {
    position: 'absolute',
    backgroundColor: '#1e293b',
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 10,
    color: '#000000',
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  legendFullscreen: {
    marginTop: 0,
    paddingHorizontal: 8,
  },
  legendPortrait: {
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(15,23,42,0.04)',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 0,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  legendItemFullscreen: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    minHeight: 44,
    backgroundColor: 'rgba(255,255,255,0.9)',
    maxWidth: '48%',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '600',
  },
  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tooltipCard: {
    position: 'absolute',
    width: 210,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  tooltipMemberCenter: {
    alignItems: 'center',
    marginBottom: 8,
  },
  tooltipMemberImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 6,
    backgroundColor: '#e2e8f0',
  },
  tooltipMemberName: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  tooltipTimestamp: {
    color: '#000000',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'left',
  },
  tooltipLabel: {
    color: '#000000',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'left',
  },
  tooltipAmount: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'left',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 12,
  },
});

