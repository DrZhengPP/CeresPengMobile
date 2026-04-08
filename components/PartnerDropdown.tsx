import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

interface Props {
  onSelect?: (partner: string | null) => void;
}

export default function PartnerDropdown({ onSelect }: Props) {
  const [partners, setPartners] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/clients`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: string[]) => {
        setPartners(data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? partners.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
    : partners;

  function handleSelect(partner: string) {
    setSelected(partner);
    setModalVisible(false);
    setSearch('');
    onSelect?.(partner);
  }

  function handleClear() {
    setSelected(null);
    setSearch('');
    onSelect?.(null);
  }

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Select partner"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
            {selected ?? 'Select partner…'}
          </Text>
        )}
        {selected ? (
          <Pressable onPress={handleClear} hitSlop={8} accessibilityLabel="Clear selection">
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        ) : (
          <Text style={styles.chevron}>▾</Text>
        )}
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Select Partner</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            autoFocus
            clearButtonMode="while-editing"
          />
          {error ? (
            <Text style={styles.errorText}>Failed to load: {error}</Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.item, item === selected && styles.itemSelected]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[styles.itemText, item === selected && styles.itemTextSelected]}>
                    {item}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No partners found</Text>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  placeholder: {
    color: '#9ca3af',
  },
  chevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  clearBtn: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '55%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  searchInput: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    fontSize: 14,
    color: '#111827',
  },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  itemSelected: {
    backgroundColor: '#eff6ff',
  },
  itemText: {
    fontSize: 14,
    color: '#374151',
  },
  itemTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 24,
    fontSize: 14,
  },
  errorText: {
    textAlign: 'center',
    color: '#ef4444',
    marginTop: 24,
    fontSize: 13,
    paddingHorizontal: 20,
  },
});
