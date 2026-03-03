/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, people_v1 } from 'googleapis';
import { AuthManager } from '../auth/AuthManager';
import { logToFile } from '../utils/logger';

export class ContactsService {
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  private async getPeopleClient(): Promise<people_v1.People> {
    const auth = await this.authManager.getAuthenticatedClient();
    return google.people({ version: 'v1', auth });
  }

  /**
   * 連絡先の一覧を取得します。
   */
  async listContacts(pageSize: number = 100): Promise<people_v1.Schema$ListConnectionsResponse> {
    logToFile('ContactsService.listContacts called');
    const people = await this.getPeopleClient();
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: pageSize,
      personFields: 'names,emailAddresses,phoneNumbers,biographies,memberships',
    });
    return response.data;
  }

  /**
   * 名前やメールアドレスで連絡先を検索します。
   */
  async searchContacts(query: string): Promise<people_v1.Schema$SearchResponse> {
    logToFile(`ContactsService.searchContacts called with query: ${query}`);
    const people = await this.getPeopleClient();
    const response = await people.people.searchContacts({
      query: query,
      readMask: 'names,emailAddresses,phoneNumbers,biographies,memberships',
    });
    return response.data;
  }

  /**
   * 連絡先の情報を更新します（メモの登録など）。
   */
  async updateContact(resourceName: string, notes: string): Promise<people_v1.Schema$Person> {
    logToFile(`ContactsService.updateContact called for ${resourceName}`);
    const people = await this.getPeopleClient();
    
    // 現在の情報を取得して etag を得る
    const currentPerson = await people.people.get({
      resourceName: resourceName,
      personFields: 'metadata',
    });

    const response = await people.people.updateContact({
      resourceName: resourceName,
      updatePersonFields: 'biographies',
      requestBody: {
        etag: currentPerson.data.etag,
        biographies: [
          {
            value: notes,
            contentType: 'TEXT_PLAIN',
          },
        ],
      },
    });
    return response.data;
  }

  /**
   * 連絡先を新規作成します。
   */
  async createContact(firstName: string, familyName: string = ''): Promise<people_v1.Schema$Person> {
    logToFile(`ContactsService.createContact called for ${familyName} ${firstName}`);
    const people = await this.getPeopleClient();
    const response = await people.people.createContact({
      requestBody: {
        names: [
          {
            givenName: firstName,
            familyName: familyName,
          },
        ],
      },
    });
    return response.data;
  }
}
