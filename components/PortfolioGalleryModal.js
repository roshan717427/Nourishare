import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 10;
const GRID_PADDING = 20;
const TILE_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

function GalleryTile({
  dish,
  onPress,
  showFavorite,
  isFavorited,
  onToggleFavorite,
  showDelete,
  onDelete,
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.85}>
      {dish.photoUrl ? (
        <Image source={{ uri: dish.photoUrl }} style={styles.tileImage} />
      ) : (
        <View style={[styles.tileImage, styles.tilePlaceholder]}>
          <Ionicons name="restaurant-outline" size={28} color={colors.textMuted} />
        </View>
      )}
      {showDelete ? (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete?.();
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel="Delete logged dish"
        >
          <Ionicons name="trash-outline" size={15} color={colors.error} />
        </TouchableOpacity>
      ) : null}
      {showFavorite ? (
        <TouchableOpacity
          style={[styles.favoriteButton, isFavorited && styles.favoriteButtonActive]}
          onPress={(e) => {
            e.stopPropagation?.();
            onToggleFavorite?.();
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel={isFavorited ? 'Remove from portfolio favorites' : 'Add to portfolio favorites'}
        >
          <Ionicons
            name={isFavorited ? 'heart' : 'heart-outline'}
            size={16}
            color={isFavorited ? colors.card : colors.primary}
          />
        </TouchableOpacity>
      ) : null}
      <View style={styles.tileOverlay}>
        <Text style={styles.tileTitle} numberOfLines={2}>
          {dish.title}
        </Text>
        {dish.rating != null && dish.rating !== '' ? (
          <View style={styles.tileRating}>
            <Ionicons name="star" size={11} color={colors.star} />
            <Text style={styles.tileRatingText}>{dish.rating}/5</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function PortfolioGalleryModal({
  visible,
  dishes,
  ownerName,
  onClose,
  onDishPress,
  showFavorite,
  favoriteIds,
  onToggleFavorite,
  showDelete,
  onDelete,
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Culinary Portfolio</Text>
              <Text style={styles.subtitle}>
                {ownerName ? `${ownerName}'s dishes` : 'All dishes'} · {dishes.length}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close gallery">
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={dishes}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <GalleryTile
                dish={item}
                onPress={() => onDishPress?.(item)}
                showFavorite={showFavorite}
                isFavorited={favoriteIds?.includes(item.id)}
                onToggleFavorite={() => onToggleFavorite?.(item.id)}
                showDelete={showDelete}
                onDelete={() => onDelete?.(item)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="images-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>No dishes in this portfolio yet.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.5)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: GRID_PADDING,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  closeButton: {
    padding: spacing.xs,
  },
  listContent: {
    padding: GRID_PADDING,
    paddingBottom: spacing.xl,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tile: {
    width: TILE_SIZE,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  favoriteButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tileImage: {
    width: '100%',
    height: TILE_SIZE * 0.85,
    backgroundColor: colors.borderLight,
  },
  tilePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileOverlay: {
    padding: spacing.sm,
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  tileRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tileRatingText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
  },
});
