import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface CommitBreakdown {
  penaltyId: string;
  penaltyName: string;
  count: number;
  multiplierBreakdown?: Array<{ count: number; multiplier: number }>;
}

interface MemberCommitProfileProps {
  memberId: string;
  memberName: string;
  photoUri?: string;
  commits: CommitBreakdown[];
  totalAmount?: number;
  currency?: string;
  // Optional fields for Tab1 context
  playtime?: number;
  attendancePercentage?: number;
  variant?: 'compact' | 'extended'; // 'compact' = SessionDetails, 'extended' = Tab1
}

export default function MemberCommitProfile(props: MemberCommitProfileProps) {
  const {
    memberId,
    memberName,
    photoUri,
    commits,
    totalAmount,
    currency = '$',
    playtime,
    attendancePercentage,
    variant = 'compact',
  } = props;

  const dummyAvatar = useMemo(
    () => require('../../assets/images/dummy/default_member.png'),
    []
  );

  const avatarSource = photoUri ? { uri: photoUri } : dummyAvatar;

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <View style={styles.container}>
      {/* Header: Image + Name (centered & large) */}
      <View style={styles.header}>
        <Image source={avatarSource} style={styles.avatarLarge} />
        <Text style={styles.memberNameLarge}>{memberName}</Text>
      </View>

      {/* Extended variant: Add playtime and attendance below name */}
      {variant === 'extended' && (playtime !== undefined || attendancePercentage !== undefined) && (
        <View style={styles.extendedInfoSection}>
          {playtime !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Playtime:</Text>
              <Text style={styles.infoValue}>{formatTime(playtime)}</Text>
            </View>
          )}
          {attendancePercentage !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Attendance:</Text>
              <Text style={styles.infoValue}>{attendancePercentage.toFixed(0)}%</Text>
            </View>
          )}
        </View>
      )}

      {/* Commit Counts Section */}
      {commits.length > 0 && (
        <View style={styles.commitsSection}>
          {commits.map((commit, index) => (
            <View key={`${commit.penaltyId}-${index}`} style={styles.commitBlock}>
              {/* Penalty name + count */}
              <View style={styles.commitHeader}>
                <Text style={styles.penaltyName}>{commit.penaltyName}:</Text>
                <Text style={styles.commitCount}>{commit.count}</Text>
              </View>

              {/* Multiplier breakdown lines (if present) */}
              {commit.multiplierBreakdown && commit.multiplierBreakdown.length > 0 && (
                <View style={styles.multiplierBreakdown}>
                  {commit.multiplierBreakdown.map((item, idx) => (
                    <Text key={idx} style={styles.multiplierLine}>
                      {item.count} × {item.multiplier}x multiplier
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Thick divider line */}
      {(commits.length > 0 || totalAmount !== undefined) && (
        <View style={styles.thickDivider} />
      )}

      {/* Total Amount (below divider) */}
      {totalAmount !== undefined && (
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Session Total:</Text>
          <Text style={[styles.totalAmount, getTotalAmountStyle(totalAmount)]}>
            {currency}{totalAmount.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}

function getTotalAmountStyle(amount: number) {
  if (amount < 0) {
    return styles.amountPositive; // Green for negative (credit/owed)
  } else if (amount > 0) {
    return styles.amountNegative; // Red for positive (debt/owed by member)
  }
  return styles.amountNeutral; // Neutral for zero
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  memberNameLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  extendedInfoSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  commitsSection: {
    marginBottom: 12,
    gap: 8,
  },
  commitBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
  },
  commitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  penaltyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  commitCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
  },
  multiplierBreakdown: {
    marginTop: 6,
    paddingLeft: 8,
    gap: 4,
  },
  multiplierLine: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  thickDivider: {
    height: 3,
    backgroundColor: '#1e293b',
    marginVertical: 12,
    borderRadius: 1,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  amountNegative: {
    color: '#ef4444',
  },
  amountPositive: {
    color: '#10b981',
  },
  amountNeutral: {
    color: '#64748b',
  },
});
