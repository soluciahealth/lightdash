// ConnectionsModal.tsx
import { FC } from 'react';
import { Modal, Group, Text, Stack, TextInput, Button } from '@mantine/core';
import { Connection } from '@lightdash/common';
import { ConnectionType } from '@lightdash/common';

interface ConnectionsModalProps {
  opened: boolean;
  onClose: () => void;
  shopUrl: string;
  setShopUrl: (v: string) => void;
  handleRefresh: () => void;
  handleConnect: (config: any) => void;
  selectedConnection: Connection | null;
  config: Record<string, any>;
}

const ConnectionsModal: FC<ConnectionsModalProps> = ({
  opened,
  onClose,
  shopUrl,
  setShopUrl,
  handleRefresh,
  handleConnect,
  selectedConnection,
  config,
}) => {
  console.log('ConnectionsModal props:', config);
  const isValidShop = (s: string) => true
  //  /^[a-z0-9][a-z0-9-]*\.(myshopify\.com)$/i.test(s.trim());

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group spacing="xs">
          <img
            src={config.icon || '/logos/default.svg'}
            alt={config.name || 'Connection Icon'}
            style={{ width: 24, height: 24 }}
          />
          <Text fw={600} size="lg">
            Connect your {config.name} account
          </Text>
        </Group>
      }
      centered
      radius="md"
      size="lg"
    >
      <Stack spacing="lg" mt="md">
        {config.key === ConnectionType.SHOPIFY && (
          <Text>
        <TextInput
          label="Store URL"
          placeholder="e.g. myshop.myshopify.com"
          value={shopUrl}
          onChange={(e) => setShopUrl(e.currentTarget.value)}
          radius="md"
        />
        
        </Text>
        )}
        <Group position="right">
          <Button variant="default" onClick={handleRefresh} disabled={!isValidShop(shopUrl) || !!!selectedConnection}>
            Refresh Data
          </Button>
          <Button onClick={() => handleConnect( config )} disabled={!isValidShop(shopUrl) || !!selectedConnection}>
            Connect
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};


export default ConnectionsModal;
