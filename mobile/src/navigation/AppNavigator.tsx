import { NavigationContainer, DarkTheme as NavDark, DefaultTheme as NavLight } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme as useNavTheme } from '@react-navigation/native';
import { Pressable, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { useThemeCtx } from '../context/ThemeContext';

import HomeScreen from '../screens/HomeScreen';
import CatalogScreen from '../screens/CatalogScreen';
import LibraryScreen from '../screens/LibraryScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AnimeDetailScreen from '../screens/AnimeDetailScreen';
import WatchScreen from '../screens/WatchScreen';
import RatingsScreen from '../screens/RatingsScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SearchScreen from '../screens/SearchScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ChatThreadScreen from '../screens/ChatThreadScreen';
import RoomsScreen from '../screens/RoomsScreen';
import RoomWatchScreen from '../screens/RoomWatchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import QuizScreen from '../screens/QuizScreen';
import IssuesScreen from '../screens/IssuesScreen';
import AdminScreen from '../screens/AdminScreen';
import FloatingTabBar from './FloatingTabBar';
import Avatar from '../components/Avatar';

export type RootStackParamList = {
  MainTabs: undefined;
  AnimeDetail: { id: string | number; title?: string };
  Watch: { id: string | number; title?: string; episode?: number };
  Ratings: { tab?: string } | undefined;
  Schedule: undefined;
  Search: { q?: string } | undefined;
  Friends: undefined;
  Chats: undefined;
  ChatThread: { chatId: number | string; title?: string };
  Rooms: undefined;
  RoomWatch: { roomId: number | string };
  Settings: undefined;
  EditProfile: undefined;
  Quiz: undefined;
  Issues: undefined;
  Admin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabIcon({ name, color, size }: { name: any; color: string; size: number }) {
  return <MaterialCommunityIcons name={name} color={color} size={size} />;
}

function MainTabs() {
  const { user, openAuthModal } = useAuth();
  const theme = useNavTheme();

  const handleProfile = (onPress?: (e: any) => void) => (e: any) => {
    if (!user) {
      openAuthModal();
    } else {
      onPress?.(e);
    }
  };

  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, size }) => <TabIcon name="home-variant" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="CatalogTab"
        component={CatalogScreen}
        options={{
          title: 'Каталог',
          tabBarIcon: ({ color, size }) => <TabIcon name="view-grid" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{
          title: 'Библ.',
          tabBarIcon: ({ color, size }) => <TabIcon name="bookmark-multiple" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          title: 'Уведы',
          tabBarIcon: ({ color, size }) => <TabIcon name="bell-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) =>
            user ? (
              <View style={{ marginTop: 2 }}>
                <Avatar user={user} size={26} />
              </View>
            ) : (
              <TabIcon name="account-circle" color={color} size={size} />
            ),
          tabBarButton: (props: any) => {
            const { onPress: _onPress, onLongPress: _onLongPress, ...rest } = props;
            return (
              <Pressable
                {...rest}
                onPress={handleProfile(_onPress)}
                onLongPress={_onLongPress ? handleProfile(() => _onLongPress?.()) : undefined}
                style={props.style}
              >
                {props.children}
              </Pressable>
            );
          },
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isDark } = useThemeCtx();

  const navTheme = isDark
    ? { ...NavDark, colors: { ...NavDark.colors, background: '#1a1b25', card: '#1a1b25', primary: '#D0BCFF', text: '#E6E1E5', border: '#2A2B37', notification: '#D0BCFF' } }
    : { ...NavLight, colors: { ...NavLight.colors, background: '#FFFBFE', card: '#FFFBFE', primary: '#6750A4', text: '#1C1B1F', border: '#CAC4D0', notification: '#6750A4' } };

  return (
    <NavigationContainer theme={navTheme as any}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: navTheme.colors.card },
          headerTintColor: navTheme.colors.text,
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="AnimeDetail" component={AnimeDetailScreen} options={{ title: '' }} />
        <Stack.Screen name="Watch" component={WatchScreen} options={{ title: 'Просмотр' }} />
        <Stack.Screen name="Ratings" component={RatingsScreen} options={{ title: 'Рейтинги' }} />
        <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Расписание' }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Поиск' }} />
        <Stack.Screen name="Friends" component={FriendsScreen} options={{ title: 'Друзья' }} />
        <Stack.Screen name="Chats" component={ChatsScreen} options={{ title: 'Чаты' }} />
        <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: '' }} />
        <Stack.Screen name="Rooms" component={RoomsScreen} options={{ title: 'Комнаты' }} />
        <Stack.Screen name="RoomWatch" component={RoomWatchScreen} options={{ title: 'Комната' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Редактировать' }} />
        <Stack.Screen name="Quiz" component={QuizScreen} options={{ title: 'Квиз' }} />
        <Stack.Screen name="Issues" component={IssuesScreen} options={{ title: 'Баг-трекер' }} />
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Админка' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
