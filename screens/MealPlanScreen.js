import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  PanResponder,
  Animated,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNextUp } from '../context/NextUpContext';
import { colors, radii, spacing, shadows } from '../constants/theme';
import {
  addDays,
  fetchMealPlan,
  fetchShoppingList,
  formatDateKey,
  groupEntriesByDate,
  moveMealPlanEntry,
  parseDateKey,
  removeMealPlanEntry,
  scheduleRecipe,
  startOfWeek,
} from '../utils/mealPlanApi';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKS_VISIBLE = 3;

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DayCell({
  date,
  entries,
  isToday,
  isDropTarget,
  schedulingActive,
  cellRef,
  onLayout,
  onEntryPress,
  onEntryLongPress,
  onDayPress,
}) {
  const dateKey = formatDateKey(date);
  const dayEntries = entries[dateKey] || [];

  return (
    <TouchableOpacity
      ref={cellRef}
      activeOpacity={schedulingActive ? 0.7 : 1}
      onPress={schedulingActive ? () => onDayPress(dateKey) : undefined}
      style={[
        styles.dayCell,
        isToday && styles.dayCellToday,
        isDropTarget && styles.dayCellDropTarget,
        schedulingActive && styles.dayCellScheduling,
      ]}
      onLayout={onLayout}
    >
      <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
        {date.getDate()}
      </Text>
      <View style={styles.dayEntries}>
        {dayEntries.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={styles.scheduledChip}
            onPress={() => onEntryPress(entry)}
            onLongPress={(e) => onEntryLongPress(entry, dateKey, e)}
            delayLongPress={300}
            activeOpacity={0.8}
          >
            <Text style={styles.scheduledChipText} numberOfLines={2}>
              {entry.recipeName}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  );
}

function NextUpRecipeCard({ recipe, onLongPress }) {
  return (
    <TouchableOpacity
      style={[styles.nextUpCard, shadows.cardSoft]}
      onLongPress={(e) => onLongPress(recipe, e)}
      delayLongPress={250}
      activeOpacity={0.85}
    >
      {recipe.image ? (
        <Image source={{ uri: recipe.image }} style={styles.nextUpImage} />
      ) : (
        <View style={[styles.nextUpImage, styles.nextUpImagePlaceholder]}>
          <Ionicons name="restaurant-outline" size={20} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.nextUpName} numberOfLines={2}>
        {recipe.name}
      </Text>
      <View style={styles.dragHint}>
        <Ionicons name="move" size={10} color={colors.textMuted} />
        <Text style={styles.dragHintText}>Hold & drag</Text>
      </View>
    </TouchableOpacity>
  );
}

function ShoppingListModal({ visible, onClose, ingredients, loading, rangeLabel }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, shadows.card]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Shopping list</Text>
              <Text style={styles.modalSubtitle}>{rangeLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 32 }} />
          ) : ingredients.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Ionicons name="basket-outline" size={40} color={colors.textMuted} />
              <Text style={styles.modalEmptyTitle}>No ingredients yet</Text>
              <Text style={styles.modalEmptyHint}>
                Schedule recipes on your calendar to build a shopping list for this week.
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {ingredients.map((item) => (
                <View key={item.ingredient} style={styles.shoppingRow}>
                  <View style={styles.shoppingBullet} />
                  <View style={styles.shoppingTextWrap}>
                    <Text style={styles.shoppingIngredient}>{item.ingredient}</Text>
                    {item.recipes?.length > 0 ? (
                      <Text style={styles.shoppingRecipes} numberOfLines={2}>
                        For: {item.recipes.join(', ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
              <Text style={styles.shoppingDisclaimer}>
                Quantities are not combined — ingredient lines are grouped by name only.
              </Text>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function MealPlanScreen({ navigation }) {
  const { user } = useAuth();
  const { items: nextUpItems, loading: nextUpLoading } = useNextUp();
  const username = user?.username;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [entriesByDate, setEntriesByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shoppingVisible, setShoppingVisible] = useState(false);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [shoppingItems, setShoppingItems] = useState([]);

  const [dragItem, setDragItem] = useState(null);
  const [dragType, setDragType] = useState(null);
  const [dropTargetDate, setDropTargetDate] = useState(null);
  const dragPosition = useRef(new Animated.ValueXY()).current;
  const dayLayouts = useRef({});
  const dayCellRefs = useRef({});
  const dragItemRef = useRef(null);
  const dragTypeRef = useRef(null);

  useEffect(() => {
    dragItemRef.current = dragItem;
    dragTypeRef.current = dragType;
  }, [dragItem, dragType]);

  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);
  const visibleWeeks = useMemo(() => {
    const weeks = [];
    for (let w = 0; w < WEEKS_VISIBLE; w += 1) {
      const start = addDays(weekStart, w * 7);
      const days = [];
      for (let d = 0; d < 7; d += 1) {
        days.push(addDays(start, d));
      }
      weeks.push({ start, days });
    }
    return weeks;
  }, [weekStart]);

  const range = useMemo(() => {
    const firstDay = visibleWeeks[0].days[0];
    const lastWeek = visibleWeeks[visibleWeeks.length - 1];
    const lastDay = lastWeek.days[6];
    return {
      startDate: formatDateKey(firstDay),
      endDate: formatDateKey(lastDay),
    };
  }, [visibleWeeks]);

  const rangeLabel = useMemo(() => {
    const start = parseDateKey(range.startDate);
    const end = parseDateKey(range.endDate);
    const fmt = (d) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }, [range]);

  const loadPlan = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await fetchMealPlan(username, range.startDate, range.endDate);
      setEntriesByDate(groupEntriesByDate(entries));
    } catch (err) {
      setError(err.message || 'Could not load meal plan');
    } finally {
      setLoading(false);
    }
  }, [username, range.startDate, range.endDate]);

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, [loadPlan])
  );

  const findDateAtPoint = useCallback((x, y) => {
    for (const [dateKey, layout] of Object.entries(dayLayouts.current)) {
      const { pageX, pageY, width, height } = layout;
      if (x >= pageX && x <= pageX + width && y >= pageY && y <= pageY + height) {
        return dateKey;
      }
    }
    return null;
  }, []);

  const commitSchedule = useCallback(
    async (targetDate) => {
      const item = dragItemRef.current;
      const type = dragTypeRef.current;
      if (!targetDate || !item || !username) return;

      setDragItem(null);
      setDragType(null);
      setDropTargetDate(null);
      dragPosition.setValue({ x: 0, y: 0 });

      try {
        if (type === 'recipe') {
          const entry = await scheduleRecipe(username, targetDate, item);
          setEntriesByDate((prev) => {
            const next = { ...prev };
            if (!next[targetDate]) next[targetDate] = [];
            next[targetDate] = [...next[targetDate], entry];
            return next;
          });
        } else if (type === 'entry' && item.date !== targetDate) {
          const updated = await moveMealPlanEntry(username, item.id, targetDate);
          setEntriesByDate((prev) => {
            const next = { ...prev };
            const oldDate = item.date;
            if (next[oldDate]) {
              next[oldDate] = next[oldDate].filter((e) => e.id !== item.id);
              if (next[oldDate].length === 0) delete next[oldDate];
            }
            if (!next[targetDate]) next[targetDate] = [];
            next[targetDate] = [...next[targetDate], updated];
            return next;
          });
        }
      } catch (err) {
        Alert.alert('Could not schedule', err.message || 'Please try again.');
      }
    },
    [username, dragPosition]
  );

  const endDrag = useCallback(
    async (gestureX, gestureY) => {
      const targetDate = findDateAtPoint(gestureX, gestureY);
      await commitSchedule(targetDate);
    },
    [findDateAtPoint, commitSchedule]
  );

  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;

  const findDateRef = useRef(findDateAtPoint);
  findDateRef.current = findDateAtPoint;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!dragItemRef.current,
      onMoveShouldSetPanResponder: () => !!dragItemRef.current,
      onPanResponderGrant: (_, gesture) => {
        dragPosition.setValue({ x: gesture.x0 - 75, y: gesture.y0 - 40 });
      },
      onPanResponderMove: (_, gesture) => {
        dragPosition.setValue({ x: gesture.moveX - 75, y: gesture.moveY - 40 });
        const target = findDateRef.current(gesture.moveX, gesture.moveY);
        setDropTargetDate(target);
      },
      onPanResponderRelease: (_, gesture) => {
        endDragRef.current(gesture.moveX, gesture.moveY);
      },
      onPanResponderTerminate: (_, gesture) => {
        endDragRef.current(gesture.moveX, gesture.moveY);
      },
    })
  ).current;

  const startDragRecipe = (recipe, gestureEvent) => {
    setDragItem(recipe);
    setDragType('recipe');
    dragItemRef.current = recipe;
    dragTypeRef.current = 'recipe';
    const { pageX, pageY } = gestureEvent?.nativeEvent || {};
    if (pageX != null) {
      dragPosition.setValue({ x: pageX - 75, y: pageY - 40 });
    }
  };

  const startDragEntry = (entry, gestureEvent) => {
    setDragItem(entry);
    setDragType('entry');
    dragItemRef.current = entry;
    dragTypeRef.current = 'entry';
    const { pageX, pageY } = gestureEvent?.nativeEvent || {};
    if (pageX != null) {
      dragPosition.setValue({ x: pageX - 75, y: pageY - 40 });
    }
  };

  const handleEntryPress = (entry) => {
    Alert.alert(entry.recipeName, 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMealPlanEntry(username, entry.id);
            setEntriesByDate((prev) => {
              const next = { ...prev };
              if (next[entry.date]) {
                next[entry.date] = next[entry.date].filter((e) => e.id !== entry.id);
                if (next[entry.date].length === 0) delete next[entry.date];
              }
              return next;
            });
          } catch (err) {
            Alert.alert('Could not remove', err.message);
          }
        },
      },
    ]);
  };

  const openShoppingList = async () => {
    setShoppingVisible(true);
    setShoppingLoading(true);
    try {
      const data = await fetchShoppingList(username, range.startDate, range.endDate);
      setShoppingItems(data.ingredients || []);
    } catch (err) {
      setShoppingItems([]);
      Alert.alert('Shopping list', err.message || 'Could not load ingredients.');
    } finally {
      setShoppingLoading(false);
    }
  };

  const measureDayCell = useCallback((dateKey) => {
    const ref = dayCellRefs.current[dateKey];
    if (!ref?.measureInWindow) return;
    ref.measureInWindow((pageX, pageY, width, height) => {
      dayLayouts.current[dateKey] = { pageX, pageY, width, height };
    });
  }, []);

  const remeasureAllDayCells = useCallback(() => {
    Object.keys(dayCellRefs.current).forEach((dateKey) => {
      measureDayCell(dateKey);
    });
  }, [measureDayCell]);

  const registerDayCellRef = (dateKey) => (node) => {
    if (node) {
      dayCellRefs.current[dateKey] = node;
    } else {
      delete dayCellRefs.current[dateKey];
      delete dayLayouts.current[dateKey];
    }
  };

  const registerDayLayout = (dateKey) => () => {
    measureDayCell(dateKey);
  };

  const goPrevWeek = () => setWeekAnchor((prev) => addDays(prev, -7));
  const goNextWeek = () => setWeekAnchor((prev) => addDays(prev, 7));
  const goToday = () => setWeekAnchor(startOfWeek(new Date()));

  return (
    <View style={styles.container} {...(dragItem ? panResponder.panHandlers : {})}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, shadows.header]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Meal Planner</Text>
          <Text style={styles.headerSubtitle}>Cook Next calendar</Text>
        </View>
        <TouchableOpacity
          onPress={openShoppingList}
          style={styles.headerButton}
          activeOpacity={0.7}
          accessibilityLabel="Shopping list"
        >
          <Ionicons name="basket-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.weekNav}>
        <TouchableOpacity onPress={goPrevWeek} style={styles.weekNavBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToday} activeOpacity={0.7}>
          <Text style={styles.weekNavLabel}>{rangeLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goNextWeek} style={styles.weekNavBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {dragItem ? (
        <View style={styles.schedulingBanner}>
          <Text style={styles.schedulingBannerText} numberOfLines={1}>
            Scheduling: {dragType === 'entry' ? dragItem.recipeName : dragItem.name}
          </Text>
          <Text style={styles.schedulingBannerHint}>Drag or tap a day</Text>
          <TouchableOpacity
            onPress={() => {
              setDragItem(null);
              setDragType(null);
              setDropTargetDate(null);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color={colors.chipTealText} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.dayLabelsRow}>
        {DAY_LABELS.map((label) => (
          <Text key={label} style={styles.dayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPlan}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.calendarScroll}
          contentContainerStyle={styles.calendarContent}
          showsVerticalScrollIndicator={false}
          onScroll={dragItem ? remeasureAllDayCells : undefined}
          scrollEventThrottle={16}
        >
          {visibleWeeks.map((week) => (
            <View key={formatDateKey(week.start)} style={styles.weekRow}>
              {week.days.map((date) => (
                <DayCell
                  key={formatDateKey(date)}
                  date={date}
                  entries={entriesByDate}
                  isToday={isSameDay(date, today)}
                  isDropTarget={dropTargetDate === formatDateKey(date)}
                  schedulingActive={!!dragItem}
                  cellRef={registerDayCellRef(formatDateKey(date))}
                  onLayout={registerDayLayout(formatDateKey(date))}
                  onEntryPress={handleEntryPress}
                  onEntryLongPress={(entry, _dateKey, e) => startDragEntry(entry, e)}
                  onDayPress={commitSchedule}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={[styles.nextUpPanel, shadows.cardSoft]}>
        <View style={styles.nextUpHeader}>
          <Ionicons name="bookmark" size={18} color={colors.accent} />
          <Text style={styles.nextUpTitle}>Cook Next</Text>
          <Text style={styles.nextUpHint}>Hold & drag onto a day</Text>
        </View>
        {nextUpLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
        ) : nextUpItems.length === 0 ? (
          <View style={styles.nextUpEmpty}>
            <Text style={styles.nextUpEmptyText}>
              Add recipes from AI suggestions to plan them here.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nextUpRow}
          >
            {nextUpItems.map((recipe) => (
              <NextUpRecipeCard
                key={recipe.id}
                recipe={recipe}
                onLongPress={startDragRecipe}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {dragItem ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dragGhost,
            shadows.card,
            {
              transform: [
                { translateX: dragPosition.x },
                { translateY: dragPosition.y },
              ],
            },
          ]}
        >
          <Text style={styles.dragGhostText} numberOfLines={2}>
            {dragType === 'entry' ? dragItem.recipeName : dragItem.name}
          </Text>
        </Animated.View>
      ) : null}

      <ShoppingListModal
        visible={shoppingVisible}
        onClose={() => setShoppingVisible(false)}
        ingredients={shoppingItems}
        loading={shoppingLoading}
        rangeLabel={rangeLabel}
      />
    </View>
  );
}

const DAY_CELL_WIDTH = (SCREEN_WIDTH - spacing.md * 2) / 7;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md + 4,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.lg,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weekNavBtn: {
    padding: 8,
  },
  weekNavLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: 4,
  },
  dayLabel: {
    width: DAY_CELL_WIDTH,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  calendarScroll: {
    flex: 1,
  },
  calendarContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayCell: {
    width: DAY_CELL_WIDTH,
    minHeight: 88,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.card,
    padding: 4,
    marginHorizontal: 1,
  },
  dayCellToday: {
    borderColor: colors.primary,
    backgroundColor: colors.chipCoral,
  },
  dayCellDropTarget: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.chipTeal,
  },
  dayCellScheduling: {
    borderColor: colors.accent,
  },
  schedulingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.chipTeal,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  schedulingBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.chipTealText,
  },
  schedulingBannerHint: {
    fontSize: 11,
    color: colors.chipTealText,
    fontWeight: '500',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dayNumberToday: {
    color: colors.primary,
  },
  dayEntries: {
    gap: 3,
  },
  scheduledChip: {
    backgroundColor: colors.chipAmber,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  scheduledChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.chipAmberText,
    lineHeight: 12,
  },
  nextUpPanel: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.md,
  },
  nextUpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md + 4,
    marginBottom: spacing.sm,
  },
  nextUpTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  nextUpHint: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  nextUpRow: {
    paddingHorizontal: spacing.md + 4,
    paddingBottom: 4,
  },
  nextUpCard: {
    width: 110,
    marginRight: 10,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  nextUpImage: {
    width: 110,
    height: 70,
    backgroundColor: colors.borderLight,
  },
  nextUpImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextUpName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 8,
    paddingTop: 6,
    lineHeight: 16,
  },
  dragHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dragHintText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
  },
  nextUpEmpty: {
    paddingHorizontal: spacing.md + 4,
    paddingBottom: spacing.md,
  },
  nextUpEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
  dragGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 150,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 999,
  },
  dragGhostText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '75%',
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  modalEmpty: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: 8,
  },
  modalEmptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modalEmptyHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  shoppingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  shoppingBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  shoppingTextWrap: {
    flex: 1,
  },
  shoppingIngredient: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  shoppingRecipes: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  shoppingDisclaimer: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    lineHeight: 16,
  },
});
