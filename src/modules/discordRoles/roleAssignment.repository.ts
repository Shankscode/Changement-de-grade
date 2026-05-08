import type { Db } from '../../db/client.js';
import { roleAssignmentLogs } from '../../db/schema.js';
import type { NewRoleAssignmentLog } from '../../db/schema.js';

export class RoleAssignmentRepository {
  constructor(private readonly db: Db) {}

  async log(entry: Omit<NewRoleAssignmentLog, 'createdAt'>): Promise<void> {
    await this.db.insert(roleAssignmentLogs).values(entry);
  }
}
