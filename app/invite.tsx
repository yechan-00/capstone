import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { buildJoinSpaceHref, inviteCodeFromRouteParam } from '@/lib/spaceInviteClient';

/** regretwallet://invite?code= 를 기존 참여 화면으로 넘긴다. 전용 UI는 없다. */
export default function InviteSchemeRedirect() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  return <Redirect href={buildJoinSpaceHref(inviteCodeFromRouteParam(params.code)) as Href} />;
}
