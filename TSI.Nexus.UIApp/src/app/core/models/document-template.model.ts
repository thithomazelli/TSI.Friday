import { DocumentTemplateType } from '../enums/document-template-type.enum';
import { BaseModel } from './base.model';

export interface DocumentTemplate extends BaseModel {
  id?: string;
  type?: DocumentTemplateType;
  name?: string;
  fileName?: string;
}
