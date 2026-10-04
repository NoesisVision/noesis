import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';

/*
 * The qdoc example's design, `examples/qdoc-java` `2026-10-02-create-a-qdoc`,
 * cut down to what the architecture view reads: types, visibility, the types
 * properties, inputs and outputs use, and the rules with their needs.
 */

export const qdocArchitectureFixture = {
  id: '2026-10-02-create-a-qdoc',
  name: 'Create a QDoc',
  description: 'Quality managers create a QDoc.',
  needs: {
    added: [
      {
        id: 'start-a-qdoc',
        name: {
          value: 'Start a QDoc',
          author: 'agent',
        },
        stakeholder: {
          value: 'Quality managers',
          author: 'agent',
        },
        statement: {
          value:
            'The quality managers need to start a QDoc in the QDoc System when the organisation decides the QDoc is needed, naming the authors who will write the QDoc.',
          author: 'agent',
        },
      },
      {
        id: 'know-about-new-qdocs',
        name: {
          value: 'Know about new QDocs',
          author: 'agent',
        },
        stakeholder: {
          value: 'Quality managers',
          author: 'agent',
        },
        statement: {
          value:
            'The quality managers need to learn of each QDoc another quality manager creates.',
          author: 'agent',
        },
      },
      {
        id: 'ready-to-write',
        name: {
          value: 'Ready to write',
          author: 'agent',
        },
        stakeholder: {
          value: 'Authors',
          author: 'agent',
        },
        statement: {
          value:
            'The authors need a version with a content file to write in from the moment the QDoc exists.',
          author: 'agent',
        },
      },
    ],
  },
  modules: {
    added: [
      {
        id: 'module|qdocmanagement',
      },
      {
        id: 'module|qdocmanagement.preparation',
      },
      {
        id: 'module|qdocmanagement.notifications',
        rules: {
          added: [
            {
              name: 'Notifications depends on no other subsystem',
              category: {
                value: 'Quality',
                author: 'agent',
              },
              ruleType: {
                value: 'Maintainability',
                author: 'agent',
              },
              needs: {
                value: [],
                author: 'agent',
              },
            },
          ],
        },
      },
    ],
  },
  buildingBlocks: {
    added: [
      {
        id: 'building_block|qdocmanagement.preparation.QDocId',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|uuid',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.UserId',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.QDocTitle',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'A title is never blank',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Structure',
                author: 'agent',
              },
              needs: {
                value: [],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.DocumentType',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'A document type comes from the list of document types',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Structure',
                author: 'agent',
              },
              needs: {
                value: ['start-a-qdoc'],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.DocumentNumber',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.QDocStatus',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'A QDoc is either active or archived',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Structure',
                author: 'agent',
              },
              needs: {
                value: [],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.VersionStatus',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'A version status comes from the workflow statuses',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Structure',
                author: 'agent',
              },
              needs: {
                value: [],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.AssignmentRole',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'An assignment role is author, reviewer or approver',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Structure',
                author: 'agent',
              },
              needs: {
                value: [],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.Assignment',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'user',
              type: {
                value: 'building_block|qdocmanagement.preparation.UserId',
                author: 'agent',
              },
            },
            {
              name: 'role',
              type: {
                value:
                  'building_block|qdocmanagement.preparation.AssignmentRole',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.ContentFileId',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'value',
              type: {
                value: 'primitive|uuid',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.CreateQDoc',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'requestedBy',
              type: {
                value: 'building_block|qdocmanagement.preparation.UserId',
                author: 'agent',
              },
            },
            {
              name: 'title',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDocTitle',
                author: 'agent',
              },
            },
            {
              name: 'documentType',
              type: {
                value: 'building_block|qdocmanagement.preparation.DocumentType',
                author: 'agent',
              },
            },
            {
              name: 'authors',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.UserId',
                },
                author: 'agent',
              },
            },
            {
              name: 'reviewers',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.UserId',
                },
                author: 'agent',
              },
            },
            {
              name: 'approvers',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.UserId',
                },
                author: 'agent',
              },
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'A creation request names a title, a document type and at least one author',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Structure',
                author: 'agent',
              },
              needs: {
                value: ['start-a-qdoc'],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.QDocCreated',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'qdocId',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDocId',
                author: 'agent',
              },
            },
            {
              name: 'title',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDocTitle',
                author: 'agent',
              },
            },
            {
              name: 'documentNumber',
              type: {
                value:
                  'building_block|qdocmanagement.preparation.DocumentNumber',
                author: 'agent',
              },
            },
            {
              name: 'createdBy',
              type: {
                value: 'building_block|qdocmanagement.preparation.UserId',
                author: 'agent',
              },
            },
            {
              name: 'createdAt',
              type: {
                value: 'primitive|datetime',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.ContentFile',
        type: {
          value: 'entity',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'id',
              type: {
                value:
                  'building_block|qdocmanagement.preparation.ContentFileId',
                author: 'agent',
              },
            },
            {
              name: 'text',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.Version',
        type: {
          value: 'entity',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'number',
              type: {
                value: 'primitive|integer',
                author: 'agent',
              },
            },
            {
              name: 'status',
              type: {
                value:
                  'building_block|qdocmanagement.preparation.VersionStatus',
                author: 'agent',
              },
            },
            {
              name: 'contentFiles',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.ContentFile',
                },
                author: 'agent',
              },
            },
            {
              name: 'assignments',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.Assignment',
                },
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.QDoc',
        type: {
          value: 'aggregate',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'id',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDocId',
                author: 'agent',
              },
            },
            {
              name: 'title',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDocTitle',
                author: 'agent',
              },
            },
            {
              name: 'documentType',
              type: {
                value: 'building_block|qdocmanagement.preparation.DocumentType',
                author: 'agent',
              },
            },
            {
              name: 'documentNumber',
              type: {
                value:
                  'building_block|qdocmanagement.preparation.DocumentNumber',
                author: 'agent',
              },
            },
            {
              name: 'status',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDocStatus',
                author: 'agent',
              },
            },
            {
              name: 'versions',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.Version',
                },
                author: 'agent',
              },
            },
            {
              name: 'createdBy',
              type: {
                value: 'building_block|qdocmanagement.preparation.UserId',
                author: 'agent',
              },
            },
            {
              name: 'createdAt',
              type: {
                value: 'primitive|datetime',
                author: 'agent',
              },
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'A QDoc keeps at least one version',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Consistency',
                author: 'agent',
              },
              needs: {
                value: ['ready-to-write'],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.QDocRepository',
        type: {
          value: 'repository',
          author: 'agent',
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.DocumentNumberGenerator',
        type: {
          value: 'domain_service',
          author: 'agent',
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.IdentityProvider',
        type: {
          value: 'external_integration',
          author: 'agent',
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.PreparationEventPublisher',
        type: {
          value: 'external_integration',
          author: 'agent',
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.QDocCreationService',
        type: {
          value: 'application_service',
          author: 'agent',
        },
      },
      {
        id: 'building_block|qdocmanagement.notifications.Recipient',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'userId',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.preparation.NewQDocNotification',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'qdocTitle',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDocTitle',
                author: 'agent',
              },
            },
            {
              name: 'documentNumber',
              type: {
                value:
                  'building_block|qdocmanagement.preparation.DocumentNumber',
                author: 'agent',
              },
            },
            {
              name: 'createdBy',
              type: {
                value: 'building_block|qdocmanagement.preparation.UserId',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.notifications.NotifyUsers',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'recipients',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.notifications.Recipient',
                },
                author: 'agent',
              },
            },
            {
              name: 'subject',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
            {
              name: 'body',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.notifications.Notification',
        type: {
          value: 'value_object',
          author: 'agent',
        },
        properties: {
          added: [
            {
              name: 'recipient',
              type: {
                value: 'building_block|qdocmanagement.notifications.Recipient',
                author: 'agent',
              },
            },
            {
              name: 'subject',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
            {
              name: 'body',
              type: {
                value: 'primitive|string',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'building_block|qdocmanagement.notifications.NotificationSender',
        type: {
          value: 'external_integration',
          author: 'agent',
        },
      },
      {
        id: 'building_block|qdocmanagement.notifications.NotificationService',
        type: {
          value: 'application_service',
          author: 'agent',
        },
      },
    ],
  },
  behaviours: {
    added: [
      {
        id: 'behavior|qdocmanagement.preparation.QDocCreationService.createQDoc',
        type: {
          value: 'Command',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'public',
            actors: ['Quality manager'],
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'command',
              type: {
                value: 'building_block|qdocmanagement.preparation.CreateQDoc',
                author: 'agent',
              },
            },
          ],
        },
        output: {
          added: [
            {
              type: 'building_block|qdocmanagement.preparation.QDocId',
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'Only quality managers create QDocs',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'State change',
                author: 'agent',
              },
              needs: {
                value: ['start-a-qdoc'],
                author: 'agent',
              },
            },
            {
              name: 'A new QDoc carries a document number',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Consistency',
                author: 'agent',
              },
              needs: {
                value: ['start-a-qdoc'],
                author: 'agent',
              },
            },
            {
              name: 'A QDoc is saved and announced together',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Consistency',
                author: 'agent',
              },
              needs: {
                value: ['know-about-new-qdocs'],
                author: 'agent',
              },
            },
            {
              name: 'Each quality manager learns of a new QDoc',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'State change',
                author: 'agent',
              },
              needs: {
                value: ['know-about-new-qdocs'],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.preparation.QDoc.create',
        type: {
          value: 'Command',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'private',
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'command',
              type: {
                value: 'building_block|qdocmanagement.preparation.CreateQDoc',
                author: 'agent',
              },
            },
            {
              name: 'documentNumber',
              type: {
                value:
                  'building_block|qdocmanagement.preparation.DocumentNumber',
                author: 'agent',
              },
            },
          ],
        },
        output: {
          added: [
            {
              type: 'building_block|qdocmanagement.preparation.QDocCreated',
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'A new QDoc is active',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'State change',
                author: 'agent',
              },
              needs: {
                value: ['start-a-qdoc'],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.preparation.Version.createFirst',
        type: {
          value: 'Command',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'private',
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'authors',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.UserId',
                },
                author: 'agent',
              },
            },
            {
              name: 'reviewers',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.UserId',
                },
                author: 'agent',
              },
            },
            {
              name: 'approvers',
              type: {
                value: {
                  collectionOf:
                    'building_block|qdocmanagement.preparation.UserId',
                },
                author: 'agent',
              },
            },
          ],
        },
        output: {
          added: [
            {
              type: 'building_block|qdocmanagement.preparation.Version',
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'Version 1 starts with the status new',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'State change',
                author: 'agent',
              },
              needs: {
                value: ['ready-to-write'],
                author: 'agent',
              },
            },
            {
              name: 'Version 1 holds one empty content file',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Consistency',
                author: 'agent',
              },
              needs: {
                value: ['ready-to-write'],
                author: 'agent',
              },
            },
            {
              name: 'The named authors are assigned to version 1',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Consistency',
                author: 'agent',
              },
              needs: {
                value: ['start-a-qdoc'],
                author: 'agent',
              },
            },
            {
              name: 'The named reviewers are assigned to version 1',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Consistency',
                author: 'agent',
              },
              needs: {
                value: ['start-a-qdoc'],
                author: 'agent',
              },
            },
            {
              name: 'The named approvers are assigned to version 1',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'Consistency',
                author: 'agent',
              },
              needs: {
                value: ['start-a-qdoc'],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.preparation.QDocRepository.save',
        type: {
          value: 'Command',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'private',
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'qdoc',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDoc',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.preparation.DocumentNumberGenerator.next',
        type: {
          value: 'Command',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'private',
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'documentType',
              type: {
                value: 'building_block|qdocmanagement.preparation.DocumentType',
                author: 'agent',
              },
            },
          ],
        },
        output: {
          added: [
            {
              type: 'building_block|qdocmanagement.preparation.DocumentNumber',
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.preparation.IdentityProvider.isQualityManager',
        type: {
          value: 'Query',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'private',
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'user',
              type: {
                value: 'building_block|qdocmanagement.preparation.UserId',
                author: 'agent',
              },
            },
          ],
        },
        output: {
          added: [
            {
              type: 'primitive|boolean',
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.preparation.PreparationEventPublisher.publish',
        type: {
          value: 'Command',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'private',
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'event',
              type: {
                value: 'building_block|qdocmanagement.preparation.QDocCreated',
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.notifications.NotificationService.notifyUsers',
        type: {
          value: 'Command',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'public',
            actors: [],
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'command',
              type: {
                value:
                  'building_block|qdocmanagement.notifications.NotifyUsers',
                author: 'agent',
              },
            },
          ],
        },
        rules: {
          added: [
            {
              name: 'Each named recipient receives the notification',
              category: {
                value: 'Business',
                author: 'agent',
              },
              ruleType: {
                value: 'State change',
                author: 'agent',
              },
              needs: {
                value: ['know-about-new-qdocs'],
                author: 'agent',
              },
            },
            {
              name: 'A notification arrives within the maximum delay',
              category: {
                value: 'Quality',
                author: 'agent',
              },
              ruleType: {
                value: 'Performance',
                author: 'agent',
              },
              needs: {
                value: ['know-about-new-qdocs'],
                author: 'agent',
              },
            },
            {
              name: 'A failed delivery stops no other',
              category: {
                value: 'Quality',
                author: 'agent',
              },
              ruleType: {
                value: 'Reliability',
                author: 'agent',
              },
              needs: {
                value: ['know-about-new-qdocs'],
                author: 'agent',
              },
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.preparation.IdentityProvider.findQualityManagers',
        type: {
          value: 'Query',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'private',
          },
          author: 'agent',
        },
        output: {
          added: [
            {
              type: {
                collectionOf:
                  'building_block|qdocmanagement.preparation.UserId',
              },
            },
          ],
        },
      },
      {
        id: 'behavior|qdocmanagement.notifications.NotificationSender.send',
        type: {
          value: 'Command',
          author: 'agent',
        },
        visibility: {
          value: {
            kind: 'private',
          },
          author: 'agent',
        },
        input: {
          added: [
            {
              name: 'notification',
              type: {
                value:
                  'building_block|qdocmanagement.notifications.Notification',
                author: 'agent',
              },
            },
          ],
        },
      },
    ],
  },
} satisfies DesignDocumentInput;
