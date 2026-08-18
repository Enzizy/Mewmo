import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { PixelCat } from '@/components/PixelCat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fonts } from '@/constants/theme';
import { useItems } from '@/store/ItemsContext';

export default function ProjectsScreen() {
  const router = useRouter(); const { projects } = useItems();
  return <AppScreen bottomNav background={colors.paper}><ScreenHeader back /><View style={styles.hero}><View style={styles.copy}><Text style={styles.title}>PROJECTS</Text><Text style={styles.support}>Long-running work with a remembered next step.</Text></View><PixelCat pose="curious" size={82} /></View><View style={styles.list}>{projects.map((project) => <Pressable key={project.id} onPress={() => router.push({ pathname: '/project/[id]', params: { id: project.id } })} style={styles.row}><View style={styles.folder}><Feather name="folder" size={20} color={colors.ink} /></View><View style={styles.main}><Text style={styles.name}>{project.name}</Text><Text numberOfLines={2} style={styles.next}>{project.nextAction || project.currentFocus || 'No handoff note yet'}</Text><Text style={styles.status}>{project.status.toUpperCase()}</Text></View><Feather name="chevron-right" size={20} color={colors.ink} /></Pressable>)}{!projects.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>NO PROJECTS YET</Text><Text style={styles.emptyText}>Open Life → Work to create your first project.</Text></View> : null}</View></AppScreen>;
}

const styles = StyleSheet.create({ hero: { flexDirection: 'row', alignItems: 'center' }, copy: { flex: 1 }, title: { fontFamily: fonts.pixelBold, fontSize: 32, color: colors.ink }, support: { marginTop: 6, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.secondary }, list: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.borderStrong }, row: { minHeight: 104, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, folder: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong }, main: { flex: 1 }, name: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.ink }, next: { marginTop: 5, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary }, status: { marginTop: 7, fontFamily: fonts.pixelSemiBold, fontSize: 9, color: colors.accent }, empty: { paddingVertical: 80, alignItems: 'center' }, emptyTitle: { fontFamily: fonts.pixelSemiBold, fontSize: 16, color: colors.ink }, emptyText: { marginTop: 7, fontFamily: fonts.body, fontSize: 13, color: colors.secondary } });
