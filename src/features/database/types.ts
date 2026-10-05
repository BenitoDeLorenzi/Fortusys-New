export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          auth_user_id: string | null;
          avatar_url: string | null;
          name: string;
          email: string;
          role_id: string | null;
          status: "active" | "inactive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          avatar_url?: string | null;
          name: string;
          email: string;
          role_id?: string | null;
          status?: "active" | "inactive";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_users"]["Insert"]>;
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Insert"]>;
        Relationships: [];
      };
      app_events: {
        Row: {
          id: string;
          source_key: string | null;
          actor_user_id: string | null;
          category: string;
          event_type: string;
          title: string;
          message: string;
          severity: "info" | "success" | "warning" | "danger";
          entity_type: string | null;
          entity_id: string | null;
          action_href: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_key?: string | null;
          actor_user_id?: string | null;
          category?: string;
          event_type: string;
          title: string;
          message: string;
          severity?: "info" | "success" | "warning" | "danger";
          entity_type?: string | null;
          entity_id?: string | null;
          action_href?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_events"]["Insert"]>;
        Relationships: [];
      };
      app_notifications: {
        Row: {
          id: string;
          event_id: string | null;
          user_id: string | null;
          actor_user_id: string | null;
          source_key: string | null;
          category: string;
          notification_type: string;
          title: string;
          message: string;
          severity: "info" | "success" | "warning" | "danger";
          entity_type: string | null;
          entity_id: string | null;
          action_href: string | null;
          metadata: Json;
          read_at: string | null;
          is_silent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id?: string | null;
          user_id?: string | null;
          actor_user_id?: string | null;
          source_key?: string | null;
          category?: string;
          notification_type: string;
          title: string;
          message: string;
          severity?: "info" | "success" | "warning" | "danger";
          entity_type?: string | null;
          entity_id?: string | null;
          action_href?: string | null;
          metadata?: Json;
          read_at?: string | null;
          is_silent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_notifications"]["Insert"]>;
        Relationships: [];
      };
        billing_charges: {
          Row: {
            id: string;
            payer_id: string | null;
            payer_profile_id: string | null;
            real_estate_lease_id: string | null;
            real_estate_asset_id: string | null;
            assignor_id: string | null;
            assignor_document: string | null;
            assignor_name: string | null;
            description: string;
            amount_cents: number;
            due_date: string;
            status:
              | "draft"
              | "pending"
              | "pending_emission"
              | "emitted"
              | "emission_failed"
              | "paid"
              | "overdue"
              | "canceled";
            charge_type: string;
            installment_number: number | null;
            installment_total: number | null;
            issue_date: string | null;
            provider: "tecnospeed" | null;
            provider_reference: string | null;
            provider_status: string | null;
            provider_error: string | null;
            provider_payload: Json;
            emitted_at: string | null;
            paid_at: string | null;
            metadata: Json;
            created_at: string;
            updated_at: string;
          };
          Insert: {
            id?: string;
            payer_id?: string | null;
            payer_profile_id?: string | null;
            real_estate_lease_id?: string | null;
            real_estate_asset_id?: string | null;
            assignor_id?: string | null;
            assignor_document?: string | null;
            assignor_name?: string | null;
            description: string;
            amount_cents: number;
            due_date: string;
            status?:
              | "draft"
              | "pending"
              | "pending_emission"
              | "emitted"
              | "emission_failed"
              | "paid"
              | "overdue"
              | "canceled";
            charge_type?: string;
            installment_number?: number | null;
            installment_total?: number | null;
            issue_date?: string | null;
            provider?: "tecnospeed" | null;
            provider_reference?: string | null;
            provider_status?: string | null;
            provider_error?: string | null;
            provider_payload?: Json;
            emitted_at?: string | null;
            paid_at?: string | null;
            metadata?: Json;
            created_at?: string;
            updated_at?: string;
          };
        Update: Partial<
          Database["public"]["Tables"]["billing_charges"]["Insert"]
        >;
        Relationships: [];
      };
      billing_ticket_status_cache: {
        Row: {
          integration_id: string;
          provider: "tecnospeed";
          assignor_document: string | null;
          status: string | null;
          event_type: string | null;
          last_payload: Json;
          updated_at: string;
        };
        Insert: {
          integration_id: string;
          provider?: "tecnospeed";
          assignor_document?: string | null;
          status?: string | null;
          event_type?: string | null;
          last_payload?: Json;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["billing_ticket_status_cache"]["Insert"]
        >;
        Relationships: [];
      };
      billing_webhook_events: {
        Row: {
          id: string;
          provider: "tecnospeed";
          event_type: string | null;
          assignor_document: string | null;
          integration_id: string | null;
          status: string | null;
          payload: Json;
          received_at: string;
        };
        Insert: {
          id?: string;
          provider?: "tecnospeed";
          event_type?: string | null;
          assignor_document?: string | null;
          integration_id?: string | null;
          status?: string | null;
          payload?: Json;
          received_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["billing_webhook_events"]["Insert"]
        >;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          document: string;
          email: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          document: string;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      payers: {
        Row: {
          id: string;
          firestore_id: string | null;
          code: number | null;
          name: string;
          document: string;
          email: string | null;
          phone: string | null;
          zip_code: string | null;
          street: string | null;
          number: string | null;
          complement: string | null;
          district: string | null;
          city: string | null;
          state: string | null;
          status: "active" | "inactive";
          roles: Array<"payer" | "tenant" | "buyer" | "guarantor">;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firestore_id?: string | null;
          code?: number | null;
          name: string;
          document: string;
          email?: string | null;
          phone?: string | null;
          zip_code?: string | null;
          street?: string | null;
          number?: string | null;
          complement?: string | null;
          district?: string | null;
          city?: string | null;
          state?: string | null;
          status?: "active" | "inactive";
          roles?: Array<"payer" | "tenant" | "buyer" | "guarantor">;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payers"]["Insert"]>;
        Relationships: [];
      };
      real_estate_assets: {
        Row: {
          id: string;
          firestore_id: string | null;
          code: number | null;
          title: string;
          property_name: string | null;
          type: string;
          status: string;
          motive: string | null;
          address: string | null;
          notes: string | null;
          zip_code: string | null;
          street: string | null;
          number: string | null;
          district: string | null;
          city: string | null;
          state: string | null;
          bedrooms: string | null;
          bathrooms: string | null;
          garage: string | null;
          area: string | null;
          registration_number: string | null;
          municipal_registration: string | null;
          rent_amount: string | null;
          condominium_amount: string | null;
          iptu_amount: string | null;
          payer_iptu: string | null;
          payer_condominium: string | null;
          energy_contract: string | null;
          energy_meter: string | null;
          water_contract: string | null;
          water_meter: string | null;
          water_amount: string | null;
          energy_amount: string | null;
          gas_amount: string | null;
          trash_amount: string | null;
          reserve_fund_amount: string | null;
          other_amount: string | null;
          commission_type: string | null;
          commission_percentage: string | null;
          commission_amount: string | null;
          landlord_firestore_id: string | null;
          landlord_code: number | null;
          landlord_name: string | null;
          landlord_document: string | null;
          landlord_email: string | null;
          landlord_phone: string | null;
          contract_firestore_id: string | null;
          highlight: boolean;
          photos: Json;
          documents: Json;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firestore_id?: string | null;
          code?: number | null;
          title: string;
          property_name?: string | null;
          type?: string;
          status?: string;
          motive?: string | null;
          address?: string | null;
          notes?: string | null;
          zip_code?: string | null;
          street?: string | null;
          number?: string | null;
          district?: string | null;
          city?: string | null;
          state?: string | null;
          bedrooms?: string | null;
          bathrooms?: string | null;
          garage?: string | null;
          area?: string | null;
          registration_number?: string | null;
          municipal_registration?: string | null;
          rent_amount?: string | null;
          condominium_amount?: string | null;
          iptu_amount?: string | null;
          payer_iptu?: string | null;
          payer_condominium?: string | null;
          energy_contract?: string | null;
          energy_meter?: string | null;
          water_contract?: string | null;
          water_meter?: string | null;
          water_amount?: string | null;
          energy_amount?: string | null;
          gas_amount?: string | null;
          trash_amount?: string | null;
          reserve_fund_amount?: string | null;
          other_amount?: string | null;
          commission_type?: string | null;
          commission_percentage?: string | null;
          commission_amount?: string | null;
          landlord_firestore_id?: string | null;
          landlord_code?: number | null;
          landlord_name?: string | null;
          landlord_document?: string | null;
          landlord_email?: string | null;
          landlord_phone?: string | null;
          contract_firestore_id?: string | null;
          highlight?: boolean;
          photos?: Json;
          documents?: Json;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_estate_assets"]["Insert"]
        >;
        Relationships: [];
      };
      real_estate_leases: {
        Row: {
          id: string;
          firestore_id: string | null;
          code: number | null;
          asset_id: string;
          tenant_id: string;
          status: "draft" | "active" | "ended" | "canceled";
          document_status:
            | "not_generated"
            | "draft_generated"
            | "pending_signature"
            | "signed";
          contract_number: string | null;
          start_date: string;
          end_date: string;
          payment_due_day: number | null;
          rent_amount_cents: number;
          guarantee_type:
            | "none"
            | "deposit"
            | "guarantor"
            | "insurance"
            | "capitalization";
          guarantee_amount_cents: number | null;
          adjustment_index: "none" | "ipca" | "igpm" | "other";
          next_adjustment_date: string | null;
          guarantor_firestore_id: string | null;
          guarantor_id: string | null;
          guarantor_name: string | null;
          guarantor_document: string | null;
          notes: string | null;
          legacy_metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firestore_id?: string | null;
          code?: number | null;
          asset_id: string;
          tenant_id: string;
          status?: "draft" | "active" | "ended" | "canceled";
          document_status?:
            | "not_generated"
            | "draft_generated"
            | "pending_signature"
            | "signed";
          contract_number?: string | null;
          start_date: string;
          end_date: string;
          payment_due_day?: number | null;
          rent_amount_cents: number;
          guarantee_type?:
            | "none"
            | "deposit"
            | "guarantor"
            | "insurance"
            | "capitalization";
          guarantee_amount_cents?: number | null;
          adjustment_index?: "none" | "ipca" | "igpm" | "other";
          next_adjustment_date?: string | null;
          guarantor_firestore_id?: string | null;
          guarantor_id?: string | null;
          guarantor_name?: string | null;
          guarantor_document?: string | null;
          notes?: string | null;
          legacy_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_estate_leases"]["Insert"]
        >;
        Relationships: [];
      };
      real_estate_charges: {
        Row: {
          id: string;
          asset_id: string;
          lease_id: string;
          tenant_id: string;
          competence_month: number;
          competence_year: number;
          due_date: string;
          rent_amount_cents: number;
          additional_amount_cents: number;
          discount_amount_cents: number;
          total_amount_cents: number;
          status: "open" | "paid" | "overdue" | "canceled";
          ticket_status:
            | "not_generated"
            | "registering"
            | "registered"
            | "failed"
            | "canceled";
          ticket_provider: string | null;
          ticket_integration_id: string | null;
          ticket_print_id: string | null;
          ticket_document_number: string | null;
          ticket_our_number: string | null;
          ticket_bank_code: string | null;
          ticket_account_number: string | null;
          ticket_agreement_number: string | null;
          ticket_reference_code: string | null;
          ticket_assignor_document: string | null;
          ticket_provider_status: string | null;
          ticket_url: string | null;
          ticket_digitable_line: string | null;
          ticket_pix_url: string | null;
          ticket_error_message: string | null;
          ticket_generated_at: string | null;
          ticket_provider_payload: Json;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          lease_id: string;
          tenant_id: string;
          competence_month: number;
          competence_year: number;
          due_date: string;
          rent_amount_cents?: number;
          additional_amount_cents?: number;
          discount_amount_cents?: number;
          total_amount_cents?: number;
          status?: "open" | "paid" | "overdue" | "canceled";
          ticket_status?:
            | "not_generated"
            | "registering"
            | "registered"
            | "failed"
            | "canceled";
          ticket_provider?: string | null;
          ticket_integration_id?: string | null;
          ticket_print_id?: string | null;
          ticket_document_number?: string | null;
          ticket_our_number?: string | null;
          ticket_bank_code?: string | null;
          ticket_account_number?: string | null;
          ticket_agreement_number?: string | null;
          ticket_reference_code?: string | null;
          ticket_assignor_document?: string | null;
          ticket_provider_status?: string | null;
          ticket_url?: string | null;
          ticket_digitable_line?: string | null;
          ticket_pix_url?: string | null;
          ticket_error_message?: string | null;
          ticket_generated_at?: string | null;
          ticket_provider_payload?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_estate_charges"]["Insert"]
        >;
        Relationships: [];
      };
      real_estate_charge_items: {
        Row: {
          id: string;
          charge_id: string;
          type:
            | "rent"
            | "iptu"
            | "condominium"
            | "reserve_fund"
            | "water"
            | "energy"
            | "trash"
            | "gas"
            | "other"
            | "discount";
          description: string | null;
          amount_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          charge_id: string;
          type:
            | "rent"
            | "iptu"
            | "condominium"
            | "reserve_fund"
            | "water"
            | "energy"
            | "trash"
            | "gas"
            | "other"
            | "discount";
          description?: string | null;
          amount_cents?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_estate_charge_items"]["Insert"]
        >;
        Relationships: [];
      };
      real_estate_charge_tickets: {
        Row: {
          id: string;
          charge_id: string;
          provider: string;
          integration_id: string | null;
          print_id: string | null;
          document_number: string | null;
          our_number: string | null;
          bank_code: string | null;
          account_number: string | null;
          agreement_number: string | null;
          reference_code: string | null;
          assignor_document: string | null;
          provider_status: string | null;
          ticket_status:
            | "not_generated"
            | "registering"
            | "registered"
            | "failed"
            | "canceled";
          url: string | null;
          pix_url: string | null;
          digitable_line: string | null;
          error_message: string | null;
          provider_payload: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          charge_id: string;
          provider?: string;
          integration_id?: string | null;
          print_id?: string | null;
          document_number?: string | null;
          our_number?: string | null;
          bank_code?: string | null;
          account_number?: string | null;
          agreement_number?: string | null;
          reference_code?: string | null;
          assignor_document?: string | null;
          provider_status?: string | null;
          ticket_status?:
            | "not_generated"
            | "registering"
            | "registered"
            | "failed"
            | "canceled";
          url?: string | null;
          pix_url?: string | null;
          digitable_line?: string | null;
          error_message?: string | null;
          provider_payload?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_estate_charge_tickets"]["Insert"]
        >;
        Relationships: [];
      };
      real_estate_legacy_billings: {
        Row: {
          id: string;
          asset_id: string | null;
          firestore_asset_id: string;
          property_code: number | null;
          property_title: string | null;
          provider: string;
          provider_status: string | null;
          integration_id: string;
          print_id: string | null;
          document_number: string | null;
          our_number: string | null;
          bank_code: string | null;
          account_number: string | null;
          agreement_number: string | null;
          reference_code: string | null;
          assignor_document: string | null;
          created_at_provider: string | null;
          raw_payload: Json;
          imported_at: string;
        };
        Insert: {
          id?: string;
          asset_id?: string | null;
          firestore_asset_id: string;
          property_code?: number | null;
          property_title?: string | null;
          provider?: string;
          provider_status?: string | null;
          integration_id: string;
          print_id?: string | null;
          document_number?: string | null;
          our_number?: string | null;
          bank_code?: string | null;
          account_number?: string | null;
          agreement_number?: string | null;
          reference_code?: string | null;
          assignor_document?: string | null;
          created_at_provider?: string | null;
          raw_payload?: Json;
          imported_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_estate_legacy_billings"]["Insert"]
        >;
        Relationships: [];
      };
      real_estate_contract_models: {
        Row: {
          id: string;
          name: string;
          contract_purpose: "rental" | "sale";
          property_usage: "residential" | "commercial";
          description: string | null;
          notes: string | null;
          status: "active" | "inactive";
          is_default: boolean;
          witness_1_name: string | null;
          witness_1_document: string | null;
          witness_2_name: string | null;
          witness_2_document: string | null;
          clauses: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contract_purpose: "rental" | "sale";
          property_usage: "residential" | "commercial";
          description?: string | null;
          notes?: string | null;
          status?: "active" | "inactive";
          is_default?: boolean;
          witness_1_name?: string | null;
          witness_1_document?: string | null;
          witness_2_name?: string | null;
          witness_2_document?: string | null;
          clauses?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_estate_contract_models"]["Insert"]
        >;
        Relationships: [];
      };
      real_estate_contract_events: {
        Row: {
          id: string;
          asset_id: string;
          lease_id: string | null;
          event_type:
            | "created"
            | "updated"
            | "activated"
            | "ended"
            | "canceled"
            | "renewed";
          title: string;
          description: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          lease_id?: string | null;
          event_type:
            | "created"
            | "updated"
            | "activated"
            | "ended"
            | "canceled"
            | "renewed";
          title: string;
          description?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_estate_contract_events"]["Insert"]
        >;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: string;
          slug: string;
          permissions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
