import React, { useCallback, useEffect, useMemo } from 'react';
import { Just, Nothing } from 'folktale/maybe';
import { Grid, H5, HelpText, LinkButton, Flex } from 'indigo-react';

import { useHistory } from 'store/history';
import { useWallet } from 'store/wallet';
import { usePointCache } from 'store/pointCache';
import { usePointCursor } from 'store/pointCursor';
import { useStarReleaseCache } from 'store/starRelease';
import { useNetwork } from 'store/network';
import { useRollerStore } from 'store/rollerStore';

import * as need from 'lib/need';
import { abbreviateAddress } from 'lib/utils/address';
import useIsEclipticOwner from 'lib/useIsEclipticOwner';
import { useSyncDetails } from 'lib/useSyncPoints';
import useRejectedIncomingPointTransfers from 'lib/useRejectedIncomingPointTransfers';
import { pluralize } from 'lib/pluralize';
import Point from 'lib/types/Point';
import newGithubIssueUrl from 'new-github-issue-url';

import View from 'components/View';
import Footer from 'components/Footer';
import { ForwardButton } from 'components/Buttons';
import CopiableAddress from 'components/copiable/CopiableAddress';
import NavHeader from 'components/NavHeader';
import L2PointHeader from 'components/L2/Headers/L2PointHeader';
import IncomingPoint from 'components/L2/Points/IncomingPoint';
import LoadingOverlay from 'components/L2/LoadingOverlay';
import PointList from 'components/L2/PointList';
import { Box, Icon, Text } from '@tlon/indigo-react';

import './Points.scss';
import { StarReleaseButton } from './Points/StarReleaseButton';
import { maybeGetResult } from 'lib/maybeGetResult';
import { isGalaxy, isStar } from 'lib/utils/point';
import { L2VulnAlert } from 'components/alerts/L2VulnAlert';

export const isLocked = (details: any, contracts: any) =>
  details.owner === contracts.linearSR ||
  details.owner === contracts.conditionalSR;

interface ActionButtonProps {
  actions?: {
    text?: string;
    onClick?: () => void;
  }[];
}

function ActionButtons({ actions = [] }: ActionButtonProps) {
  return (
    <Flex row>
      {actions.map(action => (
        <Flex.Item
          key={action.text}
          as={LinkButton}
          className="mr3"
          onClick={action.onClick}>
          {action.text}
        </Flex.Item>
      ))}
    </Flex>
  );
}

export default function Points() {
  const { wallet }: any = useWallet();
  const { pop, push, names }: any = useHistory();
  const { setPointCursor }: any = usePointCursor();
  const { controlledPoints, getDetails }: any = usePointCache();
  const { contracts }: any = useNetwork();
  const isEclipticOwner = useIsEclipticOwner();
  const [
    rejectedPoints,
    addRejectedPoint,
  ] = useRejectedIncomingPointTransfers();
  const { pointList } = useRollerStore();
  const {
    syncStarReleaseDetails,
    starReleaseDetails,
  }: any = useStarReleaseCache();

  const outgoingPoints = useMemo(
    () => pointList.filter(({ isOutgoing }) => isOutgoing),
    [pointList]
  );

  const incomingPoints = useMemo(
    () =>
      pointList.filter(
        ({ isTransferProxy, value }) =>
          isTransferProxy && !rejectedPoints.includes(value)
      ),
    [pointList, rejectedPoints]
  );

  const _contracts = need.contracts(contracts);

  const maybeLockedPoints = useMemo(
    () =>
      controlledPoints.chain((points: any) =>
        points.matchWith({
          Error: () => Nothing(),
          Ok: (c: any) => {
            const points = c.value.ownedPoints.map((point: number) =>
              getDetails(point).chain((details: any) =>
                Just({ point, has: isLocked(details, _contracts) })
              )
            );
            // if we have details for every point,
            // return the array of pending transfers.
            if (points.every((p: any) => Just.hasInstance(p))) {
              const locked = points
                .filter((p: any) => p.value.has)
                .map((p: any) => p.value.point);
              return Just(locked);
            } else {
              return Nothing();
            }
          },
        })
      ),
    [getDetails, controlledPoints, _contracts]
  );

  const allPoints = useMemo(
    () =>
      pointList.filter(
        ({ isTransferProxy, isTransferProxySet, shouldDisplay, value }) =>
          shouldDisplay &&
          !(isTransferProxy || isTransferProxySet) &&
          !rejectedPoints.includes(value)
      ),
    [pointList, rejectedPoints]
  );

  // if we can only interact with a single point, jump to the point page.
  // if there are any pending transfers, incoming or outgoing, stay on this
  // page, because those can only be completed/cancelled here.
  useEffect(() => {
    if (Nothing.hasInstance(starReleaseDetails)) {
      return;
    }
    if (
      allPoints.length === 1 &&
      incomingPoints.length === 0 &&
      outgoingPoints.length === 0 &&
      (starReleaseDetails.value === null ||
        starReleaseDetails.value.total === 0)
    ) {
      setPointCursor(Just(allPoints[0].value));
      push(names.POINT);
    }
  }, [
    allPoints,
    rejectedPoints,
    outgoingPoints,
    incomingPoints,
    setPointCursor,
    push,
    names,
    starReleaseDetails,
  ]);

  const address = need.addressFromWallet(wallet);

  const loading = Nothing.hasInstance(controlledPoints);

  const ownedPoints = maybeGetResult(controlledPoints, 'ownedPoints', []);
  const lockedPoints = maybeLockedPoints
    .getOrElse([])
    .map((value: number) => ({ value }));

  const displayEmptyState =
    !loading && incomingPoints.length === 0 && allPoints.length === 0;

  // If the user has any stars or galaxies, give a polite heads up that
  // it can take some time for the roller be aware of L1 TXs
  const showMigrateNotice =
    !displayEmptyState &&
    allPoints.some(p => isStar(p.value) || isGalaxy(p.value));

  const starReleasing = starReleaseDetails
    .map((s: any) => (s ? s.total > 0 : false))
    .getOrElse(false);

  useEffect(() => {
    syncStarReleaseDetails();
  }, [syncStarReleaseDetails]);

  useEffect(() => {
    if (
      'Notification' in window &&
      Notification.permission !== 'denied' &&
      Notification.permission !== 'granted'
    ) {
      Notification.requestPermission();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // sync display details for known points
  useSyncDetails(ownedPoints);

  const goCreateGalaxy = useCallback(() => push(names.CREATE_GALAXY), [
    names.CREATE_GALAXY,
    push,
  ]);

  const goStarRelease = useCallback(() => push(names.STAR_RELEASE), [
    names.STAR_RELEASE,
    push,
  ]);

  //  if we got an error result, we should display it, instead of showing
  //  a potentially inaccurately empty point list.
  //
  if (
    Just.hasInstance(controlledPoints) &&
    controlledPoints.value.matchWith({
      Error: (e: any) => true,
      Ok: (v: any) => false,
    })
  ) {
    const url = newGithubIssueUrl({
      user: 'urbit',
      repo: 'bridge',
      title: controlledPoints.value.value,
      body: `<!-- Please provide some context. Do you have Metamask installed? What login method did you use? -->`,
    });
    return (
      <View inset>
        <Grid>
          <Grid.Item full as={HelpText} className="mt8 t-center">
            {controlledPoints.value.value}
            <br />
            Try reloading the page. If this problem persists, please{' '}
            <a href={url}>file an issue on GitHub</a>.
          </Grid.Item>
        </Grid>
      </View>
    );
  }

  if (
    loading ||
    (allPoints.length === 1 &&
      incomingPoints.length === 0 &&
      outgoingPoints.length === 0 &&
      !starReleasing)
  ) {
    return <LoadingOverlay loading />;
  }

  return (
    <View
      inset
      pop={pop}
      hideBack
      header={
        <L2PointHeader
          hideHome
          hideInvites
          showMigrate={!displayEmptyState}
          points={allPoints}
        />
      }>
      <NavHeader>
        <CopiableAddress
          text={address}
          className="f6 mono gray4 mb4 us-none pointer">
          {abbreviateAddress(address)}
        </CopiableAddress>
      </NavHeader>
      <L2VulnAlert />
      {incomingPoints.map(({ value }) => (
        <IncomingPoint
          key={value}
          point={value}
          accept={() => {
            setPointCursor(Just(value));
            push(names.ACCEPT_TRANSFER);
          }}
          reject={() => addRejectedPoint(value)}
        />
      ))}
      <Grid>
        {displayEmptyState && (
          <Grid.Item full as={Box} className="empty-points-container">
            <Text className="empty-points-text">No Urbit IDs here yet</Text>
          </Grid.Item>
        )}

        {outgoingPoints.length > 0 && (
          <Grid.Item full as={Grid} gap={1} className="mb6">
            <Grid.Item full as={H5}>
              {pluralize(
                outgoingPoints.length,
                'Outgoing Transfer',
                'Outgoing Transfers'
              )}
            </Grid.Item>
            <Grid.Item
              full
              as={PointList}
              points={outgoingPoints}
              actions={(point: Point, i: number) => (
                <ActionButtons
                  actions={[
                    {
                      text: 'Cancel',
                      onClick: () => {
                        setPointCursor(Just(point.value));
                        // TODO: deep linking to fix this duplicate route
                        push(names.CANCEL_TRANSFER);
                      },
                    },
                  ]}
                />
              )}
            />
          </Grid.Item>
        )}

        {allPoints.length > 0 && (
          <Grid.Item full as={Grid} gap={1}>
            <Grid.Item full as={PointList} points={allPoints} />
          </Grid.Item>
        )}

        {lockedPoints.length > 0 && (
          <Grid.Item full as={Grid} gap={1}>
            <Grid.Item full as={PointList} locked points={lockedPoints} />
          </Grid.Item>
        )}

        {showMigrateNotice && (
          <Grid.Item full as={Box} className={'migrated-info-box'}>
            <span className={'icon'}>
              <Icon icon="Info" />
            </span>
            <span className={'message'}>
              Not seeing a recently-migrated Layer 2 point? It may take a few
              minutes for the public roller to be aware of the transaction.
            </span>
          </Grid.Item>
        )}

        <Footer>
          <Grid>
            {isEclipticOwner && (
              <>
                <Grid.Item
                  full
                  as={ForwardButton}
                  detail="You have the authority to create a new Galaxy."
                  onClick={goCreateGalaxy}>
                  Create a galaxy
                </Grid.Item>
                <Grid.Divider />
              </>
            )}
            {starReleasing && (
              <>
                <StarReleaseButton
                  title={'Locked Stars'}
                  subtitle={`${starReleaseDetails.value.withdrawn} of ${starReleaseDetails.value.total} available`}
                  onClick={goStarRelease}></StarReleaseButton>
              </>
            )}
          </Grid>
        </Footer>
      </Grid>
    </View>
  );
}
