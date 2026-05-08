import { describe, it, expect, vi } from 'vitest';
import { DiscordLogService } from '../../src/discord/logs/discordLog.service.js';

vi.mock('../../src/shared/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function makeClient(channelFetchResult: unknown) {
  return {
    channels: {
      fetch: vi.fn().mockResolvedValue(channelFetchResult),
    },
  };
}

describe('DiscordLogService', () => {
  it('does not crash when channelId is undefined', async () => {
    const client = makeClient(null);
    const service = new DiscordLogService(client as never, undefined);

    await service.init();
    await expect(service.logUnexpectedError('test', new Error('boom'))).resolves.not.toThrow();
  });

  it('does not crash when the log channel cannot be fetched', async () => {
    const client = makeClient(null);
    client.channels.fetch = vi.fn().mockRejectedValue(new Error('not found'));

    const service = new DiscordLogService(client as never, 'invalid-channel-id');
    await service.init(); // Should not throw

    await expect(service.logVerificationSuccess('user', '#TAG', 'Name', 50_000, 50_000, false)).resolves.not.toThrow();
  });

  it('sends a message when channel is available', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const fakeChannel = {
      isTextBased: () => true,
      send: sendMock,
    };
    const client = makeClient(fakeChannel);

    const service = new DiscordLogService(client as never, 'channel-id');
    await service.init();
    await service.logVerificationSuccess('user123', '#TAG', 'Player', 50_000, 50_000, false);

    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('Verified'));
  });

  it('does not crash when send fails', async () => {
    const fakeChannel = {
      isTextBased: () => true,
      send: vi.fn().mockRejectedValue(new Error('forbidden')),
    };
    const client = makeClient(fakeChannel);

    const service = new DiscordLogService(client as never, 'channel-id');
    await service.init();

    await expect(service.logRoleAdded('user123', 'SomeRole')).resolves.not.toThrow();
  });
});
