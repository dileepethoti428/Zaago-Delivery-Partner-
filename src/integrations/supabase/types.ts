export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      admin_secret_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      agent_autopay_settings: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          is_enabled: boolean
          minimum_balance: number
          topup_amount: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          minimum_balance?: number
          topup_amount?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          minimum_balance?: number
          topup_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_autopay_settings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_bank_details: {
        Row: {
          account_holder_name: string
          account_number: string
          account_type: string | null
          agent_id: string
          bank_name: string
          created_at: string | null
          id: string
          ifsc_code: string
          is_primary: boolean | null
          is_verified: boolean | null
          updated_at: string | null
          upi_id: string | null
        }
        Insert: {
          account_holder_name: string
          account_number: string
          account_type?: string | null
          agent_id: string
          bank_name: string
          created_at?: string | null
          id?: string
          ifsc_code: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          updated_at?: string | null
          upi_id?: string | null
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          account_type?: string | null
          agent_id?: string
          bank_name?: string
          created_at?: string | null
          id?: string
          ifsc_code?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          updated_at?: string | null
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_bank_details_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_documents: {
        Row: {
          aadhar_back_url: string | null
          aadhar_front_url: string | null
          aadhar_number: string | null
          aadhar_verified: boolean | null
          agent_id: string | null
          created_at: string | null
          dl_back_url: string | null
          dl_expiry_date: string | null
          dl_front_url: string | null
          dl_number: string | null
          dl_verified: boolean | null
          id: string
          kyc_status: string | null
          profile_photo_url: string | null
          rejection_reason: string | null
          updated_at: string | null
          uploaded_at: string | null
          user_id: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          aadhar_back_url?: string | null
          aadhar_front_url?: string | null
          aadhar_number?: string | null
          aadhar_verified?: boolean | null
          agent_id?: string | null
          created_at?: string | null
          dl_back_url?: string | null
          dl_expiry_date?: string | null
          dl_front_url?: string | null
          dl_number?: string | null
          dl_verified?: boolean | null
          id?: string
          kyc_status?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          aadhar_back_url?: string | null
          aadhar_front_url?: string | null
          aadhar_number?: string | null
          aadhar_verified?: boolean | null
          agent_id?: string | null
          created_at?: string | null
          dl_back_url?: string | null
          dl_expiry_date?: string | null
          dl_front_url?: string | null
          dl_number?: string | null
          dl_verified?: boolean | null
          id?: string
          kyc_status?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_earnings_tracking: {
        Row: {
          accepted_at: string
          actual_payout: number | null
          agent_id: string
          completed_at: string | null
          created_at: string | null
          distance_km: number | null
          expected_payout: number
          id: string
          is_peak_hour: boolean | null
          order_id: string
          payment_method: string | null
          payout_breakdown: Json | null
          payout_status: string
          updated_at: string | null
        }
        Insert: {
          accepted_at: string
          actual_payout?: number | null
          agent_id: string
          completed_at?: string | null
          created_at?: string | null
          distance_km?: number | null
          expected_payout?: number
          id?: string
          is_peak_hour?: boolean | null
          order_id: string
          payment_method?: string | null
          payout_breakdown?: Json | null
          payout_status?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string
          actual_payout?: number | null
          agent_id?: string
          completed_at?: string | null
          created_at?: string | null
          distance_km?: number | null
          expected_payout?: number
          id?: string
          is_peak_hour?: boolean | null
          order_id?: string
          payment_method?: string | null
          payout_breakdown?: Json | null
          payout_status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_earnings_tracking_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_earnings_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_earnings_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_notifications: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          source_id: string | null
          source_type: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          source_id?: string | null
          source_type?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          source_id?: string | null
          source_type?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_agent_notifications_agent_id"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_order_rejections: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          order_id: string
          rejection_reason: string | null
          rejection_type: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          order_id: string
          rejection_reason?: string | null
          rejection_type?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          order_id?: string
          rejection_reason?: string | null
          rejection_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_order_rejections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_order_rejections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_order_rejections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          agent_id: string
          auto_accept_orders: boolean | null
          auto_logout: boolean | null
          created_at: string | null
          dark_mode: boolean | null
          id: string
          is_available: boolean | null
          language: string | null
          location_services: boolean | null
          notification_frequency: string | null
          notify_earnings_updates: boolean | null
          notify_new_orders: boolean | null
          notify_promotions: boolean | null
          personal_info: Json | null
          preferred_areas: Json | null
          preferred_language: string | null
          push_notifications: boolean | null
          ringtone_enabled: boolean | null
          ringtone_type: string | null
          ringtone_volume: number | null
          sound_alerts: boolean | null
          updated_at: string | null
          vehicle_info: Json | null
          vibration: boolean | null
        }
        Insert: {
          agent_id: string
          auto_accept_orders?: boolean | null
          auto_logout?: boolean | null
          created_at?: string | null
          dark_mode?: boolean | null
          id?: string
          is_available?: boolean | null
          language?: string | null
          location_services?: boolean | null
          notification_frequency?: string | null
          notify_earnings_updates?: boolean | null
          notify_new_orders?: boolean | null
          notify_promotions?: boolean | null
          personal_info?: Json | null
          preferred_areas?: Json | null
          preferred_language?: string | null
          push_notifications?: boolean | null
          ringtone_enabled?: boolean | null
          ringtone_type?: string | null
          ringtone_volume?: number | null
          sound_alerts?: boolean | null
          updated_at?: string | null
          vehicle_info?: Json | null
          vibration?: boolean | null
        }
        Update: {
          agent_id?: string
          auto_accept_orders?: boolean | null
          auto_logout?: boolean | null
          created_at?: string | null
          dark_mode?: boolean | null
          id?: string
          is_available?: boolean | null
          language?: string | null
          location_services?: boolean | null
          notification_frequency?: string | null
          notify_earnings_updates?: boolean | null
          notify_new_orders?: boolean | null
          notify_promotions?: boolean | null
          personal_info?: Json | null
          preferred_areas?: Json | null
          preferred_language?: string | null
          push_notifications?: boolean | null
          ringtone_enabled?: boolean | null
          ringtone_type?: string | null
          ringtone_volume?: number | null
          sound_alerts?: boolean | null
          updated_at?: string | null
          vehicle_info?: Json | null
          vibration?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_settings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_wallet: {
        Row: {
          agent_id: string
          balance: number | null
          created_at: string | null
          id: string
          last_settlement_date: string | null
          pending_cod_amount: number | null
          total_collected: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          balance?: number | null
          created_at?: string | null
          id?: string
          last_settlement_date?: string | null
          pending_cod_amount?: number | null
          total_collected?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          balance?: number | null
          created_at?: string | null
          id?: string
          last_settlement_date?: string | null
          pending_cod_amount?: number | null
          total_collected?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_wallet_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_wallet_transactions: {
        Row: {
          agent_id: string
          amount: number
          created_at: string | null
          description: string | null
          id: string
          order_id: string | null
          razorpay_transaction_id: string | null
          settlement_reference: string | null
          status: string | null
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          razorpay_transaction_id?: string | null
          settlement_reference?: string | null
          status?: string | null
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          razorpay_transaction_id?: string | null
          settlement_reference?: string | null
          status?: string | null
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_wallet_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_withdrawal_requests: {
        Row: {
          admin_notes: string | null
          agent_id: string
          amount: number
          bank_id: string
          created_at: string
          id: string
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          agent_id: string
          amount: number
          bank_id: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          agent_id?: string
          amount?: number
          bank_id?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_withdrawal_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_withdrawal_requests_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "agent_bank_details"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_work_sessions: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          session_end: string | null
          session_start: string
          total_hours: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          session_end?: string | null
          session_start?: string
          total_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          session_end?: string | null
          session_start?: string
          total_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_work_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          metadata: Json | null
          priority: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          target_audience: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          metadata?: Json | null
          priority?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          target_audience?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          priority?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          target_audience?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          review: string | null
          updated_at: string
          user_id: string
          version: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          review?: string | null
          updated_at?: string
          user_id: string
          version?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          review?: string | null
          updated_at?: string
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      app_shares: {
        Row: {
          created_at: string
          id: string
          referral_code: string | null
          share_method: string
          shared_to: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code?: string | null
          share_method: string
          shared_to?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string | null
          share_method?: string
          shared_to?: string | null
          user_id?: string
        }
        Relationships: []
      }
      autopay_processing_queue: {
        Row: {
          amount: number
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          retry_attempt: number | null
          scheduled_for: string
          status: string | null
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          retry_attempt?: number | null
          scheduled_for: string
          status?: string | null
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          retry_attempt?: number | null
          scheduled_for?: string
          status?: string | null
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopay_processing_queue_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      autopay_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          payment_method_id: string | null
          processed_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          retry_attempt: number | null
          status: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          payment_method_id?: string | null
          processed_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          retry_attempt?: number | null
          status: string
          subscription_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          payment_method_id?: string | null
          processed_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          retry_attempt?: number | null
          status?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopay_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "user_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_coupons: {
        Row: {
          birth_date: string
          coupon_id: string
          created_at: string | null
          expires_at: string
          id: string
          is_sent: boolean | null
          user_id: string
          year_created: number
        }
        Insert: {
          birth_date: string
          coupon_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          is_sent?: boolean | null
          user_id: string
          year_created: number
        }
        Update: {
          birth_date?: string
          coupon_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_sent?: boolean | null
          user_id?: string
          year_created?: number
        }
        Relationships: [
          {
            foreignKeyName: "birthday_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "user_eligible_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          seller_id: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          seller_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          seller_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      commission_config: {
        Row: {
          commission_rate: number
          created_at: string | null
          effective_from: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          commission_rate: number
          created_at?: string | null
          effective_from?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number
          created_at?: string | null
          effective_from?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          phone: string | null
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          phone?: string | null
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          phone?: string | null
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          birthday_month_target: boolean | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          high_spenders_only: boolean | null
          id: string
          is_active: boolean
          is_hidden: boolean
          low_spenders_only: boolean | null
          maximum_discount_amount: number | null
          maximum_user_spending: number | null
          minimum_user_spending: number | null
          name: string
          new_users_only: boolean | null
          returning_users_only: boolean | null
          target_audience: Json | null
          updated_at: string
          usage_limit: number | null
          used_count: number
          valid_from: string
          valid_until: string
        }
        Insert: {
          birthday_month_target?: boolean | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          high_spenders_only?: boolean | null
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          low_spenders_only?: boolean | null
          maximum_discount_amount?: number | null
          maximum_user_spending?: number | null
          minimum_user_spending?: number | null
          name: string
          new_users_only?: boolean | null
          returning_users_only?: boolean | null
          target_audience?: Json | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string
          valid_until: string
        }
        Update: {
          birthday_month_target?: boolean | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          high_spenders_only?: boolean | null
          id?: string
          is_active?: boolean
          is_hidden?: boolean
          low_spenders_only?: boolean | null
          maximum_discount_amount?: number | null
          maximum_user_spending?: number | null
          minimum_user_spending?: number | null
          name?: string
          new_users_only?: boolean | null
          returning_users_only?: boolean | null
          target_audience?: Json | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      cron_execution_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          executed_at: string | null
          id: string
          job_name: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          executed_at?: string | null
          id?: string
          job_name: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          executed_at?: string | null
          id?: string
          job_name?: string
          status?: string | null
        }
        Relationships: []
      }
      customer_spending: {
        Row: {
          created_at: string
          first_purchase_date: string | null
          id: string
          last_purchase_date: string | null
          total_orders: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_purchase_date?: string | null
          id?: string
          last_purchase_date?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_purchase_date?: string | null
          id?: string
          last_purchase_date?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          latitude: number | null
          location_id: number | null
          longitude: number | null
          phone: string
          pincode: string | null
          seller_id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          phone: string
          pincode?: string | null
          seller_id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          phone?: string
          pincode?: string | null
          seller_id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_orders: {
        Row: {
          assigned_agent_id: string | null
          assigned_by: string | null
          created_at: string | null
          customer_id: string
          date: string
          id: string
          location_id: number | null
          quantity: number
          status: string
          subscription_id: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_by?: string | null
          created_at?: string | null
          customer_id: string
          date: string
          id?: string
          location_id?: number | null
          quantity: number
          status?: string
          subscription_id: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_by?: string | null
          created_at?: string | null
          customer_id?: string
          date?: string
          id?: string
          location_id?: number | null
          quantity?: number
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_orders_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "daily_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_subscription_processing: {
        Row: {
          completed_at: string | null
          error_details: Json | null
          errors_count: number
          id: string
          notifications_sent: number
          orders_created: number
          processing_date: string
          processing_status: string
          started_at: string
          subscriptions_processed: number
        }
        Insert: {
          completed_at?: string | null
          error_details?: Json | null
          errors_count?: number
          id?: string
          notifications_sent?: number
          orders_created?: number
          processing_date?: string
          processing_status?: string
          started_at?: string
          subscriptions_processed?: number
        }
        Update: {
          completed_at?: string | null
          error_details?: Json | null
          errors_count?: number
          id?: string
          notifications_sent?: number
          orders_created?: number
          processing_date?: string
          processing_status?: string
          started_at?: string
          subscriptions_processed?: number
        }
        Relationships: []
      }
      delivery_addresses: {
        Row: {
          city: string
          coordinates: Json
          created_at: string
          full_address: string
          id: string
          is_default: boolean | null
          label: string
          landmark: string | null
          phone: string | null
          pincode: string
          state: string
          updated_at: string
          usage_count: number
          user_id: string
          user_name: string | null
        }
        Insert: {
          city: string
          coordinates: Json
          created_at?: string
          full_address: string
          id?: string
          is_default?: boolean | null
          label: string
          landmark?: string | null
          phone?: string | null
          pincode: string
          state: string
          updated_at?: string
          usage_count?: number
          user_id: string
          user_name?: string | null
        }
        Update: {
          city?: string
          coordinates?: Json
          created_at?: string
          full_address?: string
          id?: string
          is_default?: boolean | null
          label?: string
          landmark?: string | null
          phone?: string | null
          pincode?: string
          state?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      delivery_agent_ratings: {
        Row: {
          agent_behavior_rating: number | null
          agent_id: string
          created_at: string
          delivery_timeliness_rating: number | null
          id: string
          order_id: string
          rating: number
          review: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_behavior_rating?: number | null
          agent_id: string
          created_at?: string
          delivery_timeliness_rating?: number | null
          id?: string
          order_id: string
          rating: number
          review?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_behavior_rating?: number | null
          agent_id?: string
          created_at?: string
          delivery_timeliness_rating?: number | null
          id?: string
          order_id?: string
          rating?: number
          review?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_agents: {
        Row: {
          agent_id: string
          average_rating: number | null
          created_at: string | null
          deliveries_today: number | null
          device_info: Json | null
          documents_verified: boolean | null
          email: string
          id: string
          is_active: boolean | null
          is_online: boolean | null
          last_delivery_at: string | null
          last_location_updated_at: string | null
          last_status_change: string | null
          latitude: number | null
          location_id: number | null
          longitude: number | null
          max_capacity: number
          name: string
          onesignal_player_id: string | null
          performance_score: number | null
          phone: string | null
          profile_image: string | null
          push_subscription: Json | null
          total_deliveries: number | null
          total_earnings: number | null
          updated_at: string | null
          vehicle_number: string | null
          vehicle_type: string | null
          verification_status: string | null
        }
        Insert: {
          agent_id: string
          average_rating?: number | null
          created_at?: string | null
          deliveries_today?: number | null
          device_info?: Json | null
          documents_verified?: boolean | null
          email: string
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_delivery_at?: string | null
          last_location_updated_at?: string | null
          last_status_change?: string | null
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          max_capacity?: number
          name: string
          onesignal_player_id?: string | null
          performance_score?: number | null
          phone?: string | null
          profile_image?: string | null
          push_subscription?: Json | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
          verification_status?: string | null
        }
        Update: {
          agent_id?: string
          average_rating?: number | null
          created_at?: string | null
          deliveries_today?: number | null
          device_info?: Json | null
          documents_verified?: boolean | null
          email?: string
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_delivery_at?: string | null
          last_location_updated_at?: string | null
          last_status_change?: string | null
          latitude?: number | null
          location_id?: number | null
          longitude?: number | null
          max_capacity?: number
          name?: string
          onesignal_player_id?: string | null
          performance_score?: number | null
          phone?: string | null
          profile_image?: string | null
          push_subscription?: Json | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
          verification_status?: string | null
        }
        Relationships: []
      }
      delivery_completions: {
        Row: {
          agent_id: string
          agent_location: Json | null
          completed_at: string
          created_at: string
          customer_location: Json | null
          distance_km: number | null
          id: string
          metadata: Json | null
          order_id: string
          payment_method: string
          payout_amount: number | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_location?: Json | null
          completed_at?: string
          created_at?: string
          customer_location?: Json | null
          distance_km?: number | null
          id?: string
          metadata?: Json | null
          order_id: string
          payment_method: string
          payout_amount?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_location?: Json | null
          completed_at?: string
          created_at?: string
          customer_location?: Json | null
          distance_km?: number | null
          id?: string
          metadata?: Json | null
          order_id?: string
          payment_method?: string
          payout_amount?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_history: {
        Row: {
          agent_id: string | null
          agent_location: Json | null
          completed_at: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_rating: number | null
          delivery_address: Json
          delivery_date: string
          delivery_duration: number | null
          delivery_notes: string | null
          delivery_payout: number | null
          delivery_proof: Json | null
          delivery_time_slot: string | null
          distance_traveled: number | null
          id: string
          items: Json
          order_id: string
          payment_method: string | null
          payment_status: string
          special_instructions: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          agent_location?: Json | null
          completed_at?: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          customer_rating?: number | null
          delivery_address: Json
          delivery_date: string
          delivery_duration?: number | null
          delivery_notes?: string | null
          delivery_payout?: number | null
          delivery_proof?: Json | null
          delivery_time_slot?: string | null
          distance_traveled?: number | null
          id?: string
          items: Json
          order_id: string
          payment_method?: string | null
          payment_status?: string
          special_instructions?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          agent_location?: Json | null
          completed_at?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          customer_rating?: number | null
          delivery_address?: Json
          delivery_date?: string
          delivery_duration?: number | null
          delivery_notes?: string | null
          delivery_payout?: number | null
          delivery_proof?: Json | null
          delivery_time_slot?: string | null
          distance_traveled?: number | null
          id?: string
          items?: Json
          order_id?: string
          payment_method?: string | null
          payment_status?: string
          special_instructions?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_metrics: {
        Row: {
          agent_id: string
          average_delivery_time: number | null
          created_at: string
          customer_rating: number | null
          id: string
          metric_date: string
          successful_deliveries: number
          total_deliveries: number
          total_distance: number
          total_time: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          average_delivery_time?: number | null
          created_at?: string
          customer_rating?: number | null
          id?: string
          metric_date?: string
          successful_deliveries?: number
          total_deliveries?: number
          total_distance?: number
          total_time?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          average_delivery_time?: number | null
          created_at?: string
          customer_rating?: number | null
          id?: string
          metric_date?: string
          successful_deliveries?: number
          total_deliveries?: number
          total_distance?: number
          total_time?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          agent_id: string
          created_at: string
          estimated_duration: number | null
          id: string
          route_data: Json
          route_date: string
          status: string
          total_distance: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          estimated_duration?: number | null
          id?: string
          route_data: Json
          route_date?: string
          status?: string
          total_distance?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          estimated_duration?: number | null
          id?: string
          route_data?: Json
          route_date?: string
          status?: string
          total_distance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_slots: {
        Row: {
          capacity: number | null
          created_at: string
          end_time: string
          id: string
          is_active: boolean
          slot_name: string
          start_time: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          end_time: string
          id?: string
          is_active?: boolean
          slot_name: string
          start_time: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          end_time?: string
          id?: string
          is_active?: boolean
          slot_name?: string
          start_time?: string
        }
        Relationships: []
      }
      delivery_timings: {
        Row: {
          created_at: string
          delivery_type: string
          id: string
          is_active: boolean
          max_duration_minutes: number
          priority: number
          slot_name: string
          time_slot_end: string
          time_slot_start: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_type: string
          id?: string
          is_active?: boolean
          max_duration_minutes?: number
          priority?: number
          slot_name: string
          time_slot_end: string
          time_slot_start: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_type?: string
          id?: string
          is_active?: boolean
          max_duration_minutes?: number
          priority?: number
          slot_name?: string
          time_slot_end?: string
          time_slot_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          created_at: string
          delivery_fee: number
          id: string
          is_active: boolean
          min_order_amount: number
          name: string
          polygon: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_fee?: number
          id?: string
          is_active?: boolean
          min_order_amount?: number
          name: string
          polygon: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_fee?: number
          id?: string
          is_active?: boolean
          min_order_amount?: number
          name?: string
          polygon?: Json
          updated_at?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          agent_id: string
          created_at: string
          heading: number | null
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          agent_id: string
          created_at?: string
          heading?: number | null
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          agent_id?: string
          created_at?: string
          heading?: number | null
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          description: string | null
          distance_km: number | null
          id: string
          order_id: string
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount?: number
          created_at?: string
          description?: string | null
          distance_km?: number | null
          id?: string
          order_id: string
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          description?: string | null
          distance_km?: number | null
          id?: string
          order_id?: string
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_earnings_agent_id"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_earnings_order_id"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_earnings_order_id"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          question: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      flexible_payment_requests: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          error_message: string | null
          expires_at: string
          id: string
          payment_id: string | null
          qr_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          error_message?: string | null
          expires_at: string
          id?: string
          payment_id?: string | null
          qr_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          payment_id?: string | null
          qr_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flexible_payment_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      flexible_payments: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          expires_at: string
          id: string
          payment_received_at: string | null
          qr_code_url: string
          razorpay_qr_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          expires_at: string
          id?: string
          payment_received_at?: string | null
          qr_code_url: string
          razorpay_qr_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          expires_at?: string
          id?: string
          payment_received_at?: string | null
          qr_code_url?: string
          razorpay_qr_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flexible_payments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          id: number
          latitude: number
          longitude: number
          name: string
          radius_km: number | null
        }
        Insert: {
          id?: number
          latitude: number
          longitude: number
          name: string
          radius_km?: number | null
        }
        Update: {
          id?: number
          latitude?: number
          longitude?: number
          name?: string
          radius_km?: number | null
        }
        Relationships: []
      }
      milk_transactions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          price_per_litre: number
          quantity_litres: number
          seller_id: string
          status: string | null
          total_amount: number
          transaction_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          price_per_litre: number
          quantity_litres: number
          seller_id: string
          status?: string | null
          total_amount: number
          transaction_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          price_per_litre?: number
          quantity_litres?: number
          seller_id?: string
          status?: string | null
          total_amount?: number
          transaction_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milk_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_analytics_view"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "milk_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      non_delivery_days: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          reason: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          reason: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          reason?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          admin_notifications: boolean
          created_at: string
          email_notifications: boolean
          id: string
          marketing_notifications: boolean
          order_notifications: boolean
          push_notifications: boolean
          sms_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notifications?: boolean
          created_at?: string
          email_notifications?: boolean
          id?: string
          marketing_notifications?: boolean
          order_notifications?: boolean
          push_notifications?: boolean
          sms_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notifications?: boolean
          created_at?: string
          email_notifications?: boolean
          id?: string
          marketing_notifications?: boolean
          order_notifications?: boolean
          push_notifications?: boolean
          sms_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_recipients: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_method: string
          email: string | null
          error_message: string | null
          id: string
          notification_id: string
          phone: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          email?: string | null
          error_message?: string | null
          id?: string
          notification_id: string
          phone?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          email?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string
          phone?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "app_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json | null
          order_id: string | null
          reference_id: string | null
          role: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json | null
          order_id?: string | null
          reference_id?: string | null
          role?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json | null
          order_id?: string | null
          reference_id?: string | null
          role?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_exclusions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          order_id: string
          reason: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          order_id: string
          reason?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          order_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_exclusions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exclusions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_exclusions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_product_status: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          order_id: string
          packed_at: string | null
          product_id: string
          rejection_reason: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          order_id: string
          packed_at?: string | null
          product_id: string
          rejection_reason?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          order_id?: string
          packed_at?: string | null
          product_id?: string
          rejection_reason?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_qr_codes: {
        Row: {
          created_at: string
          id: string
          is_scanned: boolean
          order_id: string
          qr_code_data: string
          qr_image_url: string | null
          scanned_at: string | null
          scanned_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_scanned?: boolean
          order_id: string
          qr_code_data: string
          qr_image_url?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_scanned?: boolean
          order_id?: string
          qr_code_data?: string
          qr_image_url?: string | null
          scanned_at?: string | null
          scanned_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_qr_codes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_qr_codes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_qr_codes_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      order_rejections: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          order_id: string
          reason: string | null
          rejected_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          order_id: string
          reason?: string | null
          rejected_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          order_id?: string
          reason?: string | null
          rejected_at?: string
        }
        Relationships: []
      }
      order_tracking: {
        Row: {
          created_by: string | null
          id: string
          location: Json | null
          notes: string | null
          order_id: string
          status: string
          timestamp: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          location?: Json | null
          notes?: string | null
          order_id: string
          status: string
          timestamp?: string
        }
        Update: {
          created_by?: string | null
          id?: string
          location?: Json | null
          notes?: string | null
          order_id?: string
          status?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_tracking_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      order_visibility_logs: {
        Row: {
          acceptance_time: string | null
          created_at: string | null
          event_timestamp: string | null
          event_type: string
          id: string
          metadata: Json | null
          order_id: string
          status_after: string | null
          status_before: string | null
          visible_until: string | null
        }
        Insert: {
          acceptance_time?: string | null
          created_at?: string | null
          event_timestamp?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          order_id: string
          status_after?: string | null
          status_before?: string | null
          visible_until?: string | null
        }
        Update: {
          acceptance_time?: string | null
          created_at?: string | null
          event_timestamp?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          order_id?: string
          status_after?: string | null
          status_before?: string | null
          visible_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_visibility_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_visibility_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          acceptance_window_expired: boolean | null
          accepted_at: string | null
          address: Json
          agent_id: string | null
          agent_notification_sent: boolean | null
          agent_notification_sent_at: string | null
          assigned_agent_id: string | null
          assignment_type: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          delivered: boolean | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_date: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_otp: string | null
          delivery_payout: number | null
          delivery_time: string | null
          delivery_time_slot: string | null
          id: string
          items: Json
          notification_count: number
          otp_attempts: number | null
          otp_expires_at: string | null
          otp_verified: boolean | null
          otp_verified_at: string | null
          otp_verified_by: string | null
          packed_at: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          pickup_address: string | null
          pickup_location: Json | null
          pickup_status: string | null
          seller_accepted_at: string | null
          seller_latitude: number | null
          seller_longitude: number | null
          seller_name: string | null
          seller_phone: string | null
          settlement_locked: boolean | null
          special_instructions: string | null
          status: string
          subscription_id: string | null
          total: number
          tracking_id: string
          updated_at: string
          user_id: string | null
          visible: boolean | null
          visible_until: string | null
        }
        Insert: {
          acceptance_window_expired?: boolean | null
          accepted_at?: string | null
          address: Json
          agent_id?: string | null
          agent_notification_sent?: boolean | null
          agent_notification_sent_at?: string | null
          assigned_agent_id?: string | null
          assignment_type?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_date?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_otp?: string | null
          delivery_payout?: number | null
          delivery_time?: string | null
          delivery_time_slot?: string | null
          id?: string
          items: Json
          notification_count?: number
          otp_attempts?: number | null
          otp_expires_at?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          otp_verified_by?: string | null
          packed_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pickup_address?: string | null
          pickup_location?: Json | null
          pickup_status?: string | null
          seller_accepted_at?: string | null
          seller_latitude?: number | null
          seller_longitude?: number | null
          seller_name?: string | null
          seller_phone?: string | null
          settlement_locked?: boolean | null
          special_instructions?: string | null
          status?: string
          subscription_id?: string | null
          total: number
          tracking_id: string
          updated_at?: string
          user_id?: string | null
          visible?: boolean | null
          visible_until?: string | null
        }
        Update: {
          acceptance_window_expired?: boolean | null
          accepted_at?: string | null
          address?: Json
          agent_id?: string | null
          agent_notification_sent?: boolean | null
          agent_notification_sent_at?: string | null
          assigned_agent_id?: string | null
          assignment_type?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_date?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_otp?: string | null
          delivery_payout?: number | null
          delivery_time?: string | null
          delivery_time_slot?: string | null
          id?: string
          items?: Json
          notification_count?: number
          otp_attempts?: number | null
          otp_expires_at?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          otp_verified_by?: string | null
          packed_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pickup_address?: string | null
          pickup_location?: Json | null
          pickup_status?: string | null
          seller_accepted_at?: string | null
          seller_latitude?: number | null
          seller_longitude?: number | null
          seller_name?: string | null
          seller_phone?: string | null
          settlement_locked?: boolean | null
          special_instructions?: string | null
          status?: string
          subscription_id?: string | null
          total?: number
          tracking_id?: string
          updated_at?: string
          user_id?: string | null
          visible?: boolean | null
          visible_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_otp_verified_by_fkey"
            columns: ["otp_verified_by"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_rate_limits: {
        Row: {
          attempt_count: number
          blocked_until: string | null
          created_at: string
          id: string
          identifier: string
          identifier_type: string
          last_attempt: string
        }
        Insert: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          identifier: string
          identifier_type: string
          last_attempt?: string
        }
        Update: {
          attempt_count?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          identifier?: string
          identifier_type?: string
          last_attempt?: string
        }
        Relationships: []
      }
      otp_verification_attempts: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          id: string
          last_attempt_at: string | null
          otp_id: string | null
          phone: string
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          id?: string
          last_attempt_at?: string | null
          otp_id?: string | null
          phone: string
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          id?: string
          last_attempt_at?: string | null
          otp_id?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "otp_verification_attempts_otp_id_fkey"
            columns: ["otp_id"]
            isOneToOne: false
            referencedRelation: "phone_otps"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_logs: {
        Row: {
          created_at: string
          delivered_at: string | null
          email: string
          error: string | null
          event_type: string
          id: string
          metadata: Json | null
          requested_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          email: string
          error?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          requested_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          email?: string
          error?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          requested_at?: string
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          attempts: number | null
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_address: unknown
          is_used: boolean
          locked_until: string | null
          reset_key: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip_address?: unknown
          is_used?: boolean
          locked_until?: string | null
          reset_key: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          is_used?: boolean
          locked_until?: string | null
          reset_key?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          expiry_month: number | null
          expiry_year: number | null
          holder_name: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_four: string | null
          metadata: Json | null
          provider: string | null
          provider_payment_method_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          holder_name?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_four?: string | null
          metadata?: Json | null
          provider?: string | null
          provider_payment_method_id?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          holder_name?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_four?: string | null
          metadata?: Json | null
          provider?: string | null
          provider_payment_method_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          agent_name: string | null
          amount: number
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          delivered: boolean | null
          id: string
          order_id: string
          order_status: string
          payment_id: string | null
          payment_method: string | null
          payment_status: string
          transaction_date: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          agent_name?: string | null
          amount: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered?: boolean | null
          id?: string
          order_id: string
          order_status?: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string
          transaction_date?: string
          transaction_id?: string
          updated_at?: string
        }
        Update: {
          agent_name?: string | null
          amount?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered?: boolean | null
          id?: string
          order_id?: string
          order_status?: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string
          transaction_date?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_config: {
        Row: {
          base_pay_amount: number | null
          base_pay_distance_km: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          peak_hour_bonus_amount: number | null
          peak_hour_end: string | null
          peak_hour_order_threshold: number | null
          peak_hour_start: string | null
          per_km_max_rate: number | null
          per_km_min_rate: number | null
          updated_at: string | null
        }
        Insert: {
          base_pay_amount?: number | null
          base_pay_distance_km?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          peak_hour_bonus_amount?: number | null
          peak_hour_end?: string | null
          peak_hour_order_threshold?: number | null
          peak_hour_start?: string | null
          per_km_max_rate?: number | null
          per_km_min_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          base_pay_amount?: number | null
          base_pay_distance_km?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          peak_hour_bonus_amount?: number | null
          peak_hour_end?: string | null
          peak_hour_order_threshold?: number | null
          peak_hour_start?: string | null
          per_km_max_rate?: number | null
          per_km_min_rate?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number | null
          commission_rate: number | null
          created_at: string | null
          failure_reason: string | null
          id: string
          period_end: string | null
          period_start: string | null
          razorpay_payout_id: string | null
          seller_id: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          razorpay_payout_id?: string | null
          seller_id?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          razorpay_payout_id?: string | null
          seller_id?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          created_at: string | null
          delivery_attempts: number | null
          delivery_method: string | null
          delivery_status: string | null
          expires_at: string
          id: string
          otp: string
          phone: string
          updated_at: string | null
          user_data: Json | null
          verified: boolean | null
          whatsapp_message_id: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_attempts?: number | null
          delivery_method?: string | null
          delivery_status?: string | null
          expires_at: string
          id?: string
          otp: string
          phone: string
          updated_at?: string | null
          user_data?: Json | null
          verified?: boolean | null
          whatsapp_message_id?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_attempts?: number | null
          delivery_method?: string | null
          delivery_status?: string | null
          expires_at?: string
          id?: string
          otp?: string
          phone?: string
          updated_at?: string | null
          user_data?: Json | null
          verified?: boolean | null
          whatsapp_message_id?: string | null
        }
        Relationships: []
      }
      product_ratings: {
        Row: {
          created_at: string | null
          helpful_count: number | null
          id: string
          is_verified_purchase: boolean | null
          order_id: string | null
          product_id: string
          rating: number
          review: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_verified_purchase?: boolean | null
          order_id?: string | null
          product_id: string
          rating: number
          review?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_verified_purchase?: boolean | null
          order_id?: string | null
          product_id?: string
          rating?: number
          review?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ratings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ratings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_notifications: {
        Row: {
          created_at: string
          email: string
          id: string
          is_notified: boolean
          notified_at: string | null
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_notified?: boolean
          notified_at?: string | null
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_notified?: boolean
          notified_at?: string | null
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suggestions: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_latitude: number | null
          customer_location: Json | null
          customer_longitude: number | null
          description: string
          id: string
          image_url: string | null
          product_name: string
          status: string
          suggested_images: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_latitude?: number | null
          customer_location?: Json | null
          customer_longitude?: number | null
          description: string
          id?: string
          image_url?: string | null
          product_name: string
          status?: string
          suggested_images?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_latitude?: number | null
          customer_location?: Json | null
          customer_longitude?: number | null
          description?: string
          id?: string
          image_url?: string | null
          product_name?: string
          status?: string
          suggested_images?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          created_at: string
          discount_percentage: number | null
          discounted_price: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          price: number | null
          product_id: string
          stock_quantity: number | null
          updated_at: string
          variant_name: string
          variant_value: string
        }
        Insert: {
          created_at?: string
          discount_percentage?: number | null
          discounted_price?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          price?: number | null
          product_id: string
          stock_quantity?: number | null
          updated_at?: string
          variant_name: string
          variant_value: string
        }
        Update: {
          created_at?: string
          discount_percentage?: number | null
          discounted_price?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          price?: number | null
          product_id?: string
          stock_quantity?: number | null
          updated_at?: string
          variant_name?: string
          variant_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          average_rating: number | null
          base_price: number
          benefits: string[] | null
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          discount_percentage: number | null
          gst_percentage: number | null
          id: string
          image_url: string | null
          images: string[] | null
          ingredients: string[] | null
          is_active: boolean
          name: string
          nutritional_info: Json | null
          price: number
          product_lat: number | null
          product_lng: number | null
          seller_id: string | null
          stock_quantity: number | null
          subcategory_id: string | null
          tags: string[] | null
          total_ratings: number | null
          total_reviews: number | null
          type: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          base_price: number
          benefits?: string[] | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          gst_percentage?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          ingredients?: string[] | null
          is_active?: boolean
          name: string
          nutritional_info?: Json | null
          price: number
          product_lat?: number | null
          product_lng?: number | null
          seller_id?: string | null
          stock_quantity?: number | null
          subcategory_id?: string | null
          tags?: string[] | null
          total_ratings?: number | null
          total_reviews?: number | null
          type?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          base_price?: number
          benefits?: string[] | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          gst_percentage?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          ingredients?: string[] | null
          is_active?: boolean
          name?: string
          nutritional_info?: Json | null
          price?: number
          product_lat?: number | null
          product_lng?: number | null
          seller_id?: string | null
          stock_quantity?: number | null
          subcategory_id?: string | null
          tags?: string[] | null
          total_ratings?: number | null
          total_reviews?: number | null
          type?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          admin_verification_photo: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          avatar_url: string | null
          commission_rate: number | null
          created_at: string
          date_of_birth: string | null
          default_address: Json | null
          device_info: Json | null
          documents_submitted: boolean | null
          documents_verified: boolean | null
          emergency_contact: string | null
          full_name: string | null
          id: string
          notification_preferences: Json | null
          onesignal_player_id: string | null
          phone: string | null
          photo_uploaded_at: string | null
          photo_url: string | null
          photo_verified: boolean | null
          referral_applied_at: string | null
          referral_code: string | null
          referred_by: string | null
          rejection_reason: string | null
          submission_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          admin_verification_photo?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          commission_rate?: number | null
          created_at?: string
          date_of_birth?: string | null
          default_address?: Json | null
          device_info?: Json | null
          documents_submitted?: boolean | null
          documents_verified?: boolean | null
          emergency_contact?: string | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          onesignal_player_id?: string | null
          phone?: string | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photo_verified?: boolean | null
          referral_applied_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          rejection_reason?: string | null
          submission_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          admin_verification_photo?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          avatar_url?: string | null
          commission_rate?: number | null
          created_at?: string
          date_of_birth?: string | null
          default_address?: Json | null
          device_info?: Json | null
          documents_submitted?: boolean | null
          documents_verified?: boolean | null
          emergency_contact?: string | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          onesignal_player_id?: string | null
          phone?: string | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photo_verified?: boolean | null
          referral_applied_at?: string | null
          referral_code?: string | null
          referred_by?: string | null
          rejection_reason?: string | null
          submission_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          notification_id: string | null
          recipients_count: number | null
          sent_by_user_id: string | null
          success: boolean | null
          target_type: string | null
          target_user_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          notification_id?: string | null
          recipients_count?: number | null
          sent_by_user_id?: string | null
          success?: boolean | null
          target_type?: string | null
          target_user_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          notification_id?: string | null
          recipients_count?: number | null
          sent_by_user_id?: string | null
          success?: boolean | null
          target_type?: string | null
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          attempts: number | null
          created_at: string | null
          id: string
          identifier: string
          locked_until: string | null
          updated_at: string | null
          window_start: string | null
        }
        Insert: {
          action: string
          attempts?: number | null
          created_at?: string | null
          id?: string
          identifier: string
          locked_until?: string | null
          updated_at?: string | null
          window_start?: string | null
        }
        Update: {
          action?: string
          attempts?: number | null
          created_at?: string | null
          id?: string
          identifier?: string
          locked_until?: string | null
          updated_at?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      recently_viewed_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recently_viewed_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recently_viewed_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          created_at: string | null
          credited_at: string | null
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount: number | null
          reward_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credited_at?: string | null
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount?: number | null
          reward_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credited_at?: string | null
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number | null
          reward_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_code_reset_requests: {
        Row: {
          admin_email: string
          created_at: string
          expires_at: string
          id: string
          reason: string | null
          request_token: string
          requested_by_email: string | null
          requested_by_name: string | null
          status: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          admin_email: string
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string | null
          request_token: string
          requested_by_email?: string | null
          requested_by_name?: string | null
          status?: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          admin_email?: string
          created_at?: string
          expires_at?: string
          id?: string
          reason?: string | null
          request_token?: string
          requested_by_email?: string | null
          requested_by_name?: string | null
          status?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      secret_code_usage: {
        Row: {
          code_id: string | null
          email: string
          full_name: string | null
          id: string
          ip_address: string | null
          status: string
          used_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          code_id?: string | null
          email: string
          full_name?: string | null
          id?: string
          ip_address?: string | null
          status?: string
          used_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          code_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          ip_address?: string | null
          status?: string
          used_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secret_code_usage_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "admin_secret_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          resource: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      seller_product_suggestion_status: {
        Row: {
          created_at: string
          id: string
          seller_id: string
          seller_notes: string | null
          status: string
          suggestion_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          seller_id: string
          seller_notes?: string | null
          status?: string
          suggestion_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          seller_id?: string
          seller_notes?: string | null
          status?: string
          suggestion_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_product_suggestion_status_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "public_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_product_suggestion_status_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_analytics_view"
            referencedColumns: ["seller_id"]
          },
          {
            foreignKeyName: "seller_product_suggestion_status_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_product_suggestion_status_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "product_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          account_type: string | null
          address: Json | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bank_branch: string | null
          bank_name: string | null
          business_description: string | null
          business_license: string | null
          business_name: string | null
          created_at: string
          device_info: Json | null
          email: string
          id: string
          ifsc_code: string | null
          is_bank_verified: boolean | null
          latitude: number | null
          location_id: number | null
          location_verified: boolean | null
          longitude: number | null
          name: string
          onesignal_player_id: string | null
          phone: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          account_type?: string | null
          address?: Json | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          business_description?: string | null
          business_license?: string | null
          business_name?: string | null
          created_at?: string
          device_info?: Json | null
          email: string
          id?: string
          ifsc_code?: string | null
          is_bank_verified?: boolean | null
          latitude?: number | null
          location_id?: number | null
          location_verified?: boolean | null
          longitude?: number | null
          name: string
          onesignal_player_id?: string | null
          phone?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          account_type?: string | null
          address?: Json | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          business_description?: string | null
          business_license?: string | null
          business_name?: string | null
          created_at?: string
          device_info?: Json | null
          email?: string
          id?: string
          ifsc_code?: string | null
          is_bank_verified?: boolean | null
          latitude?: number | null
          location_id?: number | null
          location_verified?: boolean | null
          longitude?: number | null
          name?: string
          onesignal_player_id?: string | null
          phone?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      service_config: {
        Row: {
          created_at: string | null
          encrypted: boolean | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          encrypted?: boolean | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          encrypted?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      special_offers: {
        Row: {
          created_at: string
          created_by: string | null
          discount_percentage: number
          id: string
          is_active: boolean
          max_quantity_per_user: number | null
          offer_description: string | null
          offer_price: number
          offer_title: string
          offer_type: string
          original_price: number
          priority_rank: number | null
          product_id: string
          quantity_sold: number
          total_quantity_available: number | null
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_percentage?: number
          id?: string
          is_active?: boolean
          max_quantity_per_user?: number | null
          offer_description?: string | null
          offer_price: number
          offer_title: string
          offer_type?: string
          original_price: number
          priority_rank?: number | null
          product_id: string
          quantity_sold?: number
          total_quantity_available?: number | null
          updated_at?: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_percentage?: number
          id?: string
          is_active?: boolean
          max_quantity_per_user?: number | null
          offer_description?: string | null
          offer_price?: number
          offer_title?: string
          offer_type?: string
          original_price?: number
          priority_rank?: number | null
          product_id?: string
          quantity_sold?: number
          total_quantity_available?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_autopay_settings: {
        Row: {
          consecutive_failures: number | null
          created_at: string
          failure_reason: string | null
          id: string
          is_enabled: boolean | null
          last_payment_attempt: string | null
          max_amount_per_cycle: number | null
          next_payment_date: string | null
          payment_method_id: string | null
          retry_attempts: number | null
          retry_delay_hours: number | null
          status: string | null
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consecutive_failures?: number | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          is_enabled?: boolean | null
          last_payment_attempt?: string | null
          max_amount_per_cycle?: number | null
          next_payment_date?: string | null
          payment_method_id?: string | null
          retry_attempts?: number | null
          retry_delay_hours?: number | null
          status?: string | null
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consecutive_failures?: number | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          is_enabled?: boolean | null
          last_payment_attempt?: string | null
          max_amount_per_cycle?: number | null
          next_payment_date?: string | null
          payment_method_id?: string | null
          retry_attempts?: number | null
          retry_delay_hours?: number | null
          status?: string | null
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_autopay_settings_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "user_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_autopay_settings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_date_shifts: {
        Row: {
          created_at: string | null
          days_extended: number | null
          id: string
          new_next_delivery: string
          order_id: string | null
          original_next_delivery: string
          reason: string | null
          shift_date: string
          subscription_id: string | null
        }
        Insert: {
          created_at?: string | null
          days_extended?: number | null
          id?: string
          new_next_delivery: string
          order_id?: string | null
          original_next_delivery: string
          reason?: string | null
          shift_date: string
          subscription_id?: string | null
        }
        Update: {
          created_at?: string | null
          days_extended?: number | null
          id?: string
          new_next_delivery?: string
          order_id?: string | null
          original_next_delivery?: string
          reason?: string | null
          shift_date?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_date_shifts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_date_shifts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_date_shifts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_delivery_schedules: {
        Row: {
          created_at: string
          id: string
          notification_advance_hours: number
          scheduled_delivery_time: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_advance_hours?: number
          scheduled_delivery_time?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_advance_hours?: number
          scheduled_delivery_time?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_delivery_schedules_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_overrides: {
        Row: {
          created_at: string | null
          date: string
          id: string
          is_skip_day: boolean | null
          override_quantity: number | null
          subscription_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          is_skip_day?: boolean | null
          override_quantity?: number | null
          subscription_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          is_skip_day?: boolean | null
          override_quantity?: number | null
          subscription_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_overrides_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_vacation_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          start_date: string
          status: string
          subscription_id: string
          total_days: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          status?: string
          subscription_id: string
          total_days?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          subscription_id?: string
          total_days?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_vacation_periods_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_vacations: {
        Row: {
          applied_to_cycle: string | null
          created_at: string
          credit_amount: number
          credit_applied: boolean
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: string
          subscription_id: string
          total_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_to_cycle?: string | null
          created_at?: string
          credit_amount?: number
          credit_applied?: boolean
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: string
          subscription_id: string
          total_days: number
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_to_cycle?: string | null
          created_at?: string
          credit_amount?: number
          credit_applied?: boolean
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: string
          subscription_id?: string
          total_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_vacations_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          available_credit: number | null
          created_at: string
          created_by: string | null
          customer_id: string
          delivery_address: Json | null
          delivery_days: string[] | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_time: string | null
          delivery_time_slot: string | null
          end_date: string | null
          id: string
          is_active: boolean
          last_assigned_agent_id: string | null
          location_id: number
          next_delivery_date: string
          notification_advance_hours: number | null
          payment_id: string | null
          primary_agent_id: string | null
          product_id: string
          quantity: number
          source: string | null
          special_instructions: string | null
          start_date: string
          status: string
          subscription_type: string
          total_credit_earned: number | null
          updated_at: string
          user_id: string | null
          vacation_days_used: number | null
          vacation_extension_days: number | null
        }
        Insert: {
          available_credit?: number | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivery_address?: Json | null
          delivery_days?: string[] | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_time?: string | null
          delivery_time_slot?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          last_assigned_agent_id?: string | null
          location_id: number
          next_delivery_date: string
          notification_advance_hours?: number | null
          payment_id?: string | null
          primary_agent_id?: string | null
          product_id: string
          quantity?: number
          source?: string | null
          special_instructions?: string | null
          start_date?: string
          status?: string
          subscription_type: string
          total_credit_earned?: number | null
          updated_at?: string
          user_id?: string | null
          vacation_days_used?: number | null
          vacation_extension_days?: number | null
        }
        Update: {
          available_credit?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivery_address?: Json | null
          delivery_days?: string[] | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_time?: string | null
          delivery_time_slot?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          last_assigned_agent_id?: string | null
          location_id?: number
          next_delivery_date?: string
          notification_advance_hours?: number | null
          payment_id?: string | null
          primary_agent_id?: string | null
          product_id?: string
          quantity?: number
          source?: string | null
          special_instructions?: string | null
          start_date?: string
          status?: string
          subscription_type?: string
          total_credit_earned?: number | null
          updated_at?: string
          user_id?: string | null
          vacation_days_used?: number | null
          vacation_extension_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_last_assigned_agent_id_fkey"
            columns: ["last_assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_primary_agent_id_fkey"
            columns: ["primary_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          id: string
          message: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      todays_best_deals: {
        Row: {
          created_at: string | null
          created_by: string | null
          deal_date: string
          deal_description: string | null
          deal_title: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deal_date?: string
          deal_description?: string | null
          deal_title?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deal_date?: string
          deal_description?: string | null
          deal_title?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "todays_best_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todays_best_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_products: {
        Row: {
          average_rating: number | null
          created_at: string
          id: string
          last_order_date: string | null
          popularity_score: number
          product_id: string
          revenue_generated: number
          total_orders: number
          total_quantity_sold: number
          trending_rank: number | null
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          created_at?: string
          id?: string
          last_order_date?: string | null
          popularity_score?: number
          product_id: string
          revenue_generated?: number
          total_orders?: number
          total_quantity_sold?: number
          trending_rank?: number | null
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          created_at?: string
          id?: string
          last_order_date?: string | null
          popularity_score?: number
          product_id?: string
          revenue_generated?: number
          total_orders?: number
          total_quantity_sold?: number
          trending_rank?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trending_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trending_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      upi_transactions: {
        Row: {
          amount: number
          created_at: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          order_id: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string | null
          transaction_id: string
          updated_at: string | null
          upi_app: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          order_id: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string | null
          transaction_id: string
          updated_at?: string | null
          upi_app?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string | null
          transaction_id?: string
          updated_at?: string | null
          upi_app?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string
          device_name: string | null
          device_type: string | null
          id: string
          is_active: boolean
          last_seen: string | null
          onesignal_player_id: string
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean
          last_seen?: string | null
          onesignal_player_id: string
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          is_active?: boolean
          last_seen?: string | null
          onesignal_player_id?: string
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          pincode: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          pincode?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          pincode?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_payment_methods: {
        Row: {
          card_brand: string | null
          card_last_four: string | null
          card_network: string | null
          card_type: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          razorpay_customer_id: string
          razorpay_token_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          card_last_four?: string | null
          card_network?: string | null
          card_type?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          razorpay_customer_id: string
          razorpay_token_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          card_last_four?: string | null
          card_network?: string | null
          card_type?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          razorpay_customer_id?: string
          razorpay_token_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_player_ids: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          is_active: boolean
          player_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          player_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          player_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_product_frequency: {
        Row: {
          created_at: string
          first_purchased_at: string
          id: string
          last_purchased_at: string
          product_id: string
          purchase_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_purchased_at?: string
          id?: string
          last_purchased_at?: string
          product_id: string
          purchase_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_purchased_at?: string
          id?: string
          last_purchased_at?: string
          product_id?: string
          purchase_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_purchase_history: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          purchased_at: string
          quantity: number
          unit_price: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          purchased_at?: string
          quantity?: number
          unit_price: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          purchased_at?: string
          quantity?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          analytics: boolean
          camera_access: boolean
          created_at: string
          data_sharing: string
          delivery_updates: boolean
          id: string
          language: string
          location_services: boolean
          push_notifications: boolean
          route_changes: boolean
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics?: boolean
          camera_access?: boolean
          created_at?: string
          data_sharing?: string
          delivery_updates?: boolean
          id?: string
          language?: string
          location_services?: boolean
          push_notifications?: boolean
          route_changes?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics?: boolean
          camera_access?: boolean
          created_at?: string
          data_sharing?: string
          delivery_updates?: boolean
          id?: string
          language?: string
          location_services?: boolean
          push_notifications?: boolean
          route_changes?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      variant_templates: {
        Row: {
          category_name: string
          created_at: string
          id: string
          is_active: boolean | null
          sort_order: number | null
          template_name: string
          template_value: string
        }
        Insert: {
          category_name: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          template_name: string
          template_value: string
        }
        Update: {
          category_name?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          template_name?: string
          template_value?: string
        }
        Relationships: []
      }
      whatsapp_interactions: {
        Row: {
          contact_phone: string
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          message: string
          source_page: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          contact_phone?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          message: string
          source_page?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          contact_phone?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          message?: string
          source_page?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          agent_id: string
          amount: number
          bank_id: string
          created_at: string | null
          failure_reason: string | null
          id: string
          processed_at: string | null
          razorpay_transaction_id: string | null
          status: string
          transfer_reference: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          agent_id: string
          amount: number
          bank_id: string
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          processed_at?: string | null
          razorpay_transaction_id?: string | null
          status?: string
          transfer_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          agent_id?: string
          amount?: number
          bank_id?: string
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          processed_at?: string | null
          razorpay_transaction_id?: string | null
          status?: string
          transfer_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "agent_bank_details"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_next_delivery: {
        Row: {
          assigned_agent_id: string | null
          customer_id: string | null
          date: string | null
          order_id: string | null
          quantity: number | null
          status: string | null
          subscription_id: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          customer_id?: string | null
          date?: string | null
          order_id?: string | null
          quantity?: number | null
          status?: string | null
          subscription_id?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          customer_id?: string | null
          date?: string | null
          order_id?: string | null
          quantity?: number | null
          status?: string | null
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_orders_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "daily_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      order_analytics_mv: {
        Row: {
          confirmed_count: number | null
          day_bucket: string | null
          delivered_count: number | null
          hour_bucket: string | null
          month_bucket: string | null
          pending_count: number | null
          revenue: number | null
          total_orders: number | null
          week_bucket: string | null
        }
        Relationships: []
      }
      orders_with_agents: {
        Row: {
          address: Json | null
          agent_email: string | null
          agent_id: string | null
          agent_name: string | null
          agent_notification_sent: boolean | null
          agent_notification_sent_at: string | null
          agent_phone: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered: boolean | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_date: string | null
          delivery_time: string | null
          delivery_time_slot: string | null
          id: string | null
          items: Json | null
          payment_id: string | null
          payment_status: string | null
          pickup_address: string | null
          pickup_location: Json | null
          pickup_status: string | null
          seller_latitude: number | null
          seller_longitude: number | null
          seller_name: string | null
          seller_phone: string | null
          settlement_locked: boolean | null
          special_instructions: string | null
          status: string | null
          subscription_id: string | null
          total: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      products_with_sellers: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percentage: number | null
          id: string | null
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          name: string | null
          price: number | null
          seller_business: string | null
          seller_id: string | null
          seller_name: string | null
          stock_quantity: number | null
          type: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      public_sellers: {
        Row: {
          business_name: string | null
          created_at: string | null
          id: string | null
          name: string | null
          status: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          status?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      seller_analytics_view: {
        Row: {
          business_name: string | null
          month_stats: Json | null
          seller_email: string | null
          seller_id: string | null
          seller_name: string | null
          six_month_stats: Json | null
          week_stats: Json | null
          year_stats: Json | null
        }
        Insert: {
          business_name?: string | null
          month_stats?: never
          seller_email?: string | null
          seller_id?: string | null
          seller_name?: string | null
          six_month_stats?: never
          week_stats?: never
          year_stats?: never
        }
        Update: {
          business_name?: string | null
          month_stats?: never
          seller_email?: string | null
          seller_id?: string | null
          seller_name?: string | null
          six_month_stats?: never
          week_stats?: never
          year_stats?: never
        }
        Relationships: []
      }
      system_health_check: {
        Row: {
          active_subscriptions: number | null
          capacity_violations: number | null
          offline_agents: number | null
          online_agents: number | null
          orders_for_today: number | null
          orders_for_tomorrow: number | null
          today: string | null
          unassigned_orders_tomorrow: number | null
        }
        Relationships: []
      }
      user_eligible_coupons: {
        Row: {
          birthday_month_target: boolean | null
          code: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          high_spenders_only: boolean | null
          id: string | null
          is_active: boolean | null
          is_eligible: boolean | null
          low_spenders_only: boolean | null
          maximum_discount_amount: number | null
          maximum_user_spending: number | null
          minimum_user_spending: number | null
          name: string | null
          new_users_only: boolean | null
          returning_users_only: boolean | null
          target_audience: Json | null
          updated_at: string | null
          usage_limit: number | null
          used_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          birthday_month_target?: boolean | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          high_spenders_only?: boolean | null
          id?: string | null
          is_active?: boolean | null
          is_eligible?: never
          low_spenders_only?: boolean | null
          maximum_discount_amount?: number | null
          maximum_user_spending?: number | null
          minimum_user_spending?: number | null
          name?: string | null
          new_users_only?: boolean | null
          returning_users_only?: boolean | null
          target_audience?: Json | null
          updated_at?: string | null
          usage_limit?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          birthday_month_target?: boolean | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          high_spenders_only?: boolean | null
          id?: string | null
          is_active?: boolean | null
          is_eligible?: never
          low_spenders_only?: boolean | null
          maximum_discount_amount?: number | null
          maximum_user_spending?: number | null
          minimum_user_spending?: number | null
          name?: string | null
          new_users_only?: boolean | null
          returning_users_only?: boolean | null
          target_audience?: Json | null
          updated_at?: string | null
          usage_limit?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      user_spending_categories: {
        Row: {
          first_purchase_date: string | null
          is_birthday_month: boolean | null
          is_high_spender: boolean | null
          is_low_spender: boolean | null
          is_new_user: boolean | null
          is_returning_user: boolean | null
          last_purchase_date: string | null
          total_orders: number | null
          total_spent: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_delivery_assignment: {
        Args: { p_agent_id: string; p_order_id: string }
        Returns: Json
      }
      accept_order: {
        Args: { p_agent_id: string; p_order_id: string }
        Returns: Json
      }
      accept_product_in_order: {
        Args: { p_order_id: string; p_product_id: string; p_seller_id: string }
        Returns: Json
      }
      activate_delivery_agent: { Args: { agent_email: string }; Returns: Json }
      apply_coupon:
        | {
            Args: { p_coupon_code: string; p_order_total: number }
            Returns: Json
          }
        | {
            Args: {
              p_coupon_code: string
              p_order_total: number
              p_user_id?: string
            }
            Returns: Json
          }
      apply_targeted_coupon: {
        Args: { p_coupon_code: string; p_order_total?: number }
        Returns: Json
      }
      approve_agent_direct: {
        Args: {
          p_admin_id?: string
          p_approved: boolean
          p_rejection_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      approve_delivery_agent: {
        Args: { p_admin_user_id: string; p_agent_id: string }
        Returns: Json
      }
      approve_user: {
        Args: { admin_user_id: string; target_user_id: string }
        Returns: Json
      }
      approve_user_with_admin_photo: {
        Args: {
          admin_photo_url?: string
          admin_user_id: string
          target_user_id: string
        }
        Returns: Json
      }
      assign_delivery_agents_for: {
        Args: { p_date: string }
        Returns: undefined
      }
      assign_delivery_agents_tomorrow: { Args: never; Returns: undefined }
      assign_order_to_agent: {
        Args: { p_agent_id: string; p_order_id: string }
        Returns: Json
      }
      assign_rider: {
        Args: { _agent_id: string; _order_id: string }
        Returns: undefined
      }
      bypass_complete_delivery_direct: {
        Args: { p_order_id: string; p_payment_method?: string }
        Returns: Json
      }
      bypass_complete_order: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      calculate_country_delight_next_delivery: {
        Args: { p_current_date?: string; p_subscription_id: string }
        Returns: string
      }
      calculate_delivery_payout: {
        Args: {
          p_agent_id?: string
          p_delivery_time?: string
          p_distance_km?: number
        }
        Returns: Json
      }
      calculate_delivery_payout_safe: {
        Args: { p_distance_km?: number; p_transaction_type?: string }
        Returns: number
      }
      calculate_distance:
        | {
            Args: { lat1: number; lat2: number; lon1: number; lon2: number }
            Returns: number
          }
        | {
            Args: { lat1: number; lat2: number; lon1: number; lon2: number }
            Returns: number
          }
      calculate_next_delivery_date:
        | {
            Args: {
              p_current_date: string
              p_frequency_days: string[]
              p_frequency_type: string
              p_frequency_value: number
            }
            Returns: string
          }
        | {
            Args: {
              input_current_date?: string
              last_delivery_date?: string
              subscription_type: string
            }
            Returns: string
          }
        | {
            Args: {
              current_hour?: number
              input_current_date?: string
              last_delivery_date?: string
              subscription_type: string
            }
            Returns: string
          }
      calculate_next_delivery_date_v2: {
        Args: {
          p_current_date: string
          p_delivery_days: string[]
          p_subscription_type: string
        }
        Returns: string
      }
      calculate_next_delivery_with_vacation_skip: {
        Args: { p_current_date?: string; p_subscription_id: string }
        Returns: string
      }
      calculate_seller_payouts: {
        Args: { end_date: string; start_date: string }
        Returns: {
          commission_rate: number
          gross_amount: number
          net_amount: number
          order_count: number
          seller_id: string
        }[]
      }
      calculate_simple_next_delivery_ist: {
        Args: { p_subscription_id: string }
        Returns: string
      }
      calculate_vacation_credit: {
        Args: {
          p_end_date: string
          p_start_date: string
          p_subscription_id: string
        }
        Returns: number
      }
      can_register_admin: { Args: never; Returns: boolean }
      cancel_vacation_and_resume_subscription:
        | { Args: { p_vacation_id: string }; Returns: boolean }
        | { Args: { p_user_id?: string; p_vacation_id: string }; Returns: Json }
      check_and_shift_unaccepted_subscription_orders: {
        Args: never
        Returns: Json
      }
      check_cron_health: {
        Args: never
        Returns: {
          jobname: string
          last_run: string
          last_run_ist: string
          schedule: string
          status: string
        }[]
      }
      check_duplicate_address: {
        Args: {
          p_city: string
          p_exclude_id?: string
          p_full_address: string
          p_pincode: string
          p_user_id: string
        }
        Returns: string
      }
      check_rate_limit: {
        Args: {
          action_type: string
          max_attempts?: number
          time_window_minutes?: number
          user_identifier: string
        }
        Returns: boolean
      }
      check_seller_has_products: {
        Args: { seller_user_id: string }
        Returns: boolean
      }
      check_stuck_subscriptions: {
        Args: never
        Returns: {
          ist_time: string
          next_delivery_date: string
          product_id: string
          stuck_duration_hours: number
          subscription_id: string
          user_id: string
        }[]
      }
      check_subscription_automation_health: { Args: never; Returns: Json }
      check_subscription_delivery_anomalies: {
        Args: never
        Returns: {
          days_in_future: number
          has_active_vacation: boolean
          next_delivery_date: string
          subscription_id: string
          user_id: string
          vacation_details: Json
        }[]
      }
      check_user_vacation_status: {
        Args: { p_check_date?: string; p_user_id: string }
        Returns: Json
      }
      cleanup_abandoned_payment_orders: { Args: never; Returns: number }
      cleanup_expired_otps: { Args: never; Returns: number }
      clear_user_cart: { Args: { cart_user_id: string }; Returns: undefined }
      complete_cod_delivery: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method?: string
        }
        Returns: Json
      }
      complete_delivery_bypass_validation:
        | {
            Args: {
              p_agent_id: string
              p_order_id: string
              p_payment_method?: string
            }
            Returns: Json
          }
        | {
            Args: { p_order_id: string; p_payment_method?: string }
            Returns: undefined
          }
      complete_delivery_minimal_update: {
        Args: { p_order_id: string; p_payment_method?: string }
        Returns: boolean
      }
      complete_delivery_safe: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method?: string
        }
        Returns: Json
      }
      complete_delivery_safe_wrapper: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      complete_delivery_simple: {
        Args: {
          p_agent_id: string
          p_distance_km?: number
          p_order_id: string
          p_payment_method?: string
          p_payout_amount?: number
        }
        Returns: Json
      }
      complete_delivery_trigger_free: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method?: string
        }
        Returns: Json
      }
      complete_qr_delivery_safe: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method?: string
        }
        Returns: Json
      }
      create_admin_notification_for_agent: {
        Args: {
          admin_id?: string
          notification_message: string
          notification_title: string
          target_agent_id: string
        }
        Returns: string
      }
      create_agent_notification: {
        Args: {
          notification_message: string
          notification_metadata?: Json
          notification_title: string
          notification_type: string
          source_id?: string
          source_type?: string
          target_agent_id: string
        }
        Returns: string
      }
      create_birthday_coupons: { Args: never; Returns: number }
      create_delivery_agent: {
        Args: {
          agent_email: string
          agent_name: string
          agent_phone?: string
          custom_agent_id?: string
        }
        Returns: string
      }
      create_order_from_existing_subscription: {
        Args: { p_order_type?: string; p_subscription_id: string }
        Returns: string
      }
      create_order_from_subscription: {
        Args: { p_order_type?: string; p_subscription_id: string }
        Returns: string
      }
      create_payout: {
        Args: { end_date: string; start_date: string; target_seller_id: string }
        Returns: string
      }
      create_seller_notification_for_agent: {
        Args: {
          notification_message: string
          notification_title: string
          seller_id: string
          target_agent_id: string
        }
        Returns: string
      }
      create_subscription_monitoring_alerts: { Args: never; Returns: number }
      create_vacation_period:
        | {
            Args: {
              p_end_date: string
              p_start_date: string
              p_subscription_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_end_date: string
              p_start_date: string
              p_subscription_id: string
              p_user_id: string
            }
            Returns: Json
          }
      create_validated_payout: {
        Args: { end_date: string; start_date: string; target_seller_id: string }
        Returns: string
      }
      delete_orders_with_related_data: {
        Args: { order_ids: string[] }
        Returns: undefined
      }
      direct_complete_delivery: {
        Args: {
          p_agent_id: string
          p_new_payment_status: string
          p_new_status: string
          p_order_id: string
        }
        Returns: Json
      }
      ensure_delivery_data_consistency: { Args: never; Returns: undefined }
      extend_subscription_by_vacation: {
        Args: { p_subscription_id: string; p_vacation_days: number }
        Returns: Json
      }
      extract_seller_ids_from_order: {
        Args: { order_items: Json }
        Returns: string[]
      }
      find_or_create_location_3km: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: number
      }
      fix_all_subscription_dates_ist: { Args: never; Returns: Json }
      fix_subscription_delivery_dates: { Args: never; Returns: Json }
      fix_uncategorized_products: { Args: never; Returns: Json }
      force_complete_delivery_bypass: {
        Args: {
          p_agent_id: string
          p_delivered_at?: string
          p_order_id: string
          p_payment_status: string
        }
        Returns: Json
      }
      generate_daily_orders: { Args: never; Returns: undefined }
      generate_order_qr_code: {
        Args: { order_uuid: string }
        Returns: undefined
      }
      generate_tracking_id: { Args: never; Returns: string }
      get_agent_distance_stats: { Args: { agent_uuid: string }; Returns: Json }
      get_agent_hours_today: { Args: { agent_uuid: string }; Returns: number }
      get_agent_performance:
        | {
            Args: never
            Returns: {
              avg_rating: number
              deliveries_today: number
              online_agents: number
              total_agents: number
            }[]
          }
        | {
            Args: { limit_count?: number }
            Returns: {
              agent_id: string
              agent_name: string
              average_rating: number
              success_rate: number
              total_deliveries: number
              total_earnings: number
            }[]
          }
      get_agent_profile_with_metrics: {
        Args: { agent_email: string }
        Returns: Json
      }
      get_agent_work_stats: { Args: { agent_uuid: string }; Returns: Json }
      get_all_user_categories: {
        Args: never
        Returns: {
          is_birthday_month: boolean
          is_high_spender: boolean
          is_low_spender: boolean
          is_new_user: boolean
          is_returning_user: boolean
          total_orders: number
          total_spent: number
          user_id: string
        }[]
      }
      get_auth_user_phone: { Args: { user_email: string }; Returns: string }
      get_available_orders_for_agent: {
        Args: { p_agent_id: string }
        Returns: {
          address: Json
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_date: string
          delivery_time_slot: string
          id: string
          items: Json
          payment_status: string
          special_instructions: string
          total: number
        }[]
      }
      get_available_orders_for_agents: {
        Args: never
        Returns: {
          area: string
          created_at: string
          delivery_date: string
          order_id: string
          status: string
          total: number
        }[]
      }
      get_calculate_seller_payouts_json: {
        Args: { end_date: string; start_date: string }
        Returns: Json
      }
      get_cart_total: { Args: { cart_user_id: string }; Returns: number }
      get_current_ist_date: { Args: never; Returns: string }
      get_current_user_category: { Args: never; Returns: Json }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_customer_next_deliveries: {
        Args: { p_customer_id: string }
        Returns: {
          assigned_agent_id: string
          next_date: string
          status: string
          subscription_id: string
        }[]
      }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_delivery_agent_analytics: {
        Args: { time_period?: string }
        Returns: {
          agent_id: string
          agent_name: string
          average_rating: number
          is_active: boolean
          is_online: boolean
          last_delivery_at: string
          phone: string
          total_deliveries: number
          total_distance: number
          total_earnings: number
          vehicle_type: string
        }[]
      }
      get_delivery_performance: {
        Args: { time_period?: string }
        Returns: {
          confirmed: number
          delivered: number
          pending: number
          period_label: string
          success_rate: number
          successful_deliveries: number
          total_deliveries: number
        }[]
      }
      get_frequently_bought_products: {
        Args: { limit_count?: number; target_user_id: string }
        Returns: {
          last_purchased_at: string
          product_id: string
          product_image_url: string
          product_name: string
          product_price: number
          purchase_count: number
        }[]
      }
      get_next_delivery_date_v3: {
        Args: { p_subscription_id: string }
        Returns: string
      }
      get_or_create_notification_preferences: {
        Args: { target_user_id: string }
        Returns: {
          admin_notifications: boolean
          created_at: string
          email_notifications: boolean
          id: string
          marketing_notifications: boolean
          order_notifications: boolean
          push_notifications: boolean
          sms_notifications: boolean
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_order_analytics_series: {
        Args: { p_period: string }
        Returns: {
          bucket_label: string
          confirmed: number
          delivered: number
          pending: number
          revenue: number
        }[]
      }
      get_orders_with_agent_distance: {
        Args: {
          p_agent_latitude: number
          p_agent_longitude: number
          p_max_distance_km?: number
        }
        Returns: {
          customer_name: string
          delivery_address: Json
          delivery_latitude: number
          delivery_longitude: number
          distance_km: number
          order_id: string
          status: string
        }[]
      }
      get_pending_delivery_agents: {
        Args: never
        Returns: {
          aadhar_number: string
          aadhar_verified: boolean
          agent_id: string
          created_at: string
          dl_number: string
          dl_verified: boolean
          email: string
          full_name: string
          is_active: boolean
          phone: string
          user_id: string
          vehicle_number: string
          vehicle_type: string
          verification_status: string
        }[]
      }
      get_player_ids_by_type: {
        Args: { target_type: string }
        Returns: string[]
      }
      get_previously_bought_products: {
        Args: { limit_count?: number; target_user_id: string }
        Returns: {
          last_purchased_at: string
          product_id: string
          product_image_url: string
          product_name: string
          product_price: number
          total_quantity: number
        }[]
      }
      get_processing_history: {
        Args: { p_days?: number }
        Returns: {
          completed_at: string
          duration_seconds: number
          errors_count: number
          orders_created: number
          processing_date: string
          processing_status: string
          started_at: string
          subscriptions_processed: number
        }[]
      }
      get_product_sales_count: {
        Args: { product_uuid: string }
        Returns: number
      }
      get_product_special_offer: {
        Args: { p_product_id: string }
        Returns: {
          discount_percentage: number
          offer_description: string
          offer_id: string
          offer_price: number
          offer_title: string
          original_price: number
        }[]
      }
      get_products_within_range:
        | {
            Args: {
              customer_lat: number
              customer_lon: number
              range_km?: number
            }
            Returns: {
              distance_km: number
              product_description: string
              product_id: string
              product_image_url: string
              product_name: string
              product_price: number
              seller_id: string
              seller_location: Json
              stock_quantity: number
            }[]
          }
        | {
            Args: {
              customer_lat: number
              customer_lon: number
              range_km?: number
            }
            Returns: {
              category_id: string
              category_name: string
              discount_percentage: number
              discounted_price: number
              distance_km: number
              original_price: number
              product_description: string
              product_id: string
              product_image_url: string
              product_name: string
              product_price: number
              seller_id: string
              seller_location: Json
              stock_quantity: number
            }[]
          }
      get_recently_viewed_products: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          average_rating: number
          category_id: string
          image_url: string
          name: string
          price: number
          product_id: string
          seller_id: string
          stock_quantity: number
          total_reviews: number
          viewed_at: string
        }[]
      }
      get_seller_order_items: {
        Args: { order_items: Json; target_seller_id: string }
        Returns: {
          item_count: number
          item_names: Json
          seller_items: Json
          total_price: number
        }[]
      }
      get_seller_orders: {
        Args: { seller_user_id: string; status_filter?: string[] }
        Returns: {
          address: Json
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_time_slot: string
          id: string
          items: Json
          payment_status: string
          seller_total: number
          status: string
          total: number
        }[]
      }
      get_seller_payouts_summary_json: {
        Args: { target_seller_id: string }
        Returns: Json
      }
      get_seller_sales_analytics: {
        Args: { target_seller_id: string; time_period?: string }
        Returns: Json
      }
      get_seller_specific_orders: {
        Args: { p_seller_user_id: string }
        Returns: {
          address: Json
          agent_id: string
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_date: string
          order_id: string
          order_status: string
          payment_status: string
          seller_items: Json
          seller_total: number
          updated_at: string
        }[]
      }
      get_seller_stats: { Args: { seller_user_id: string }; Returns: Json }
      get_seller_stats_with_period: {
        Args: { seller_user_id: string; time_period?: string }
        Returns: Json
      }
      get_service_config: { Args: { config_key: string }; Returns: string }
      get_suggestions_within_range: {
        Args: { range_km?: number; seller_lat: number; seller_lon: number }
        Returns: {
          additional_notes: string
          admin_notes: string
          category: string
          created_at: string
          customer_latitude: number
          customer_location: Json
          customer_longitude: number
          description: string
          distance_km: number
          estimated_price_range: string
          id: string
          image_url: string
          product_name: string
          status: string
          suggested_images: string[]
          updated_at: string
          user_id: string
        }[]
      }
      get_top_products:
        | {
            Args: never
            Returns: {
              name: string
              qty_sold: number
              revenue: number
            }[]
          }
        | {
            Args: { limit_count?: number }
            Returns: {
              image_url: string
              product_id: string
              product_name: string
              seller_name: string
              total_revenue: number
              total_sold: number
            }[]
          }
      get_top_products_analytics: {
        Args: { limit_count?: number; time_period?: string }
        Returns: {
          period_label: string
          product_id: string
          product_image_url: string
          product_name: string
          seller_id: string
          seller_name: string
          total_orders: number
          total_quantity: number
          total_revenue: number
        }[]
      }
      get_trending_products_for_new_users: {
        Args: { limit_count?: number }
        Returns: {
          product_id: string
          product_image_url: string
          product_name: string
          product_price: number
          total_purchases: number
        }[]
      }
      get_user_category_stats: { Args: never; Returns: Json }
      get_user_eligible_coupons: {
        Args: { p_user_id: string }
        Returns: {
          birthday_month_target: boolean
          code: string
          created_at: string
          description: string
          discount_type: string
          discount_value: number
          high_spenders_only: boolean
          id: string
          is_active: boolean
          is_hidden: boolean
          low_spenders_only: boolean
          maximum_discount_amount: number
          maximum_user_spending: number
          minimum_order_amount: number
          minimum_user_spending: number
          name: string
          new_users_only: boolean
          returning_users_only: boolean
          updated_at: string
          usage_count: number
          usage_limit: number
          valid_from: string
          valid_until: string
        }[]
      }
      get_user_phone_from_metadata: {
        Args: { user_email: string }
        Returns: {
          phone: string
        }[]
      }
      get_user_player_ids: {
        Args: { target_user_id: string }
        Returns: {
          player_id: string
        }[]
      }
      get_users_by_role: {
        Args: { target_role: Database["public"]["Enums"]["app_role"] }
        Returns: {
          email: string
          full_name: string
          phone: string
          user_id: string
        }[]
      }
      get_vacation_adjusted_delivery_schedule: {
        Args: {
          p_subscription_id: string
          p_vacation_end_date: string
          p_vacation_start_date: string
        }
        Returns: Json
      }
      handle_expired_subscriptions: { Args: never; Returns: Json }
      has_agent_rejected_order: {
        Args: { p_agent_id: string; p_order_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_delivery_history_safe: {
        Args: {
          p_agent_id: string
          p_customer_name: string
          p_customer_phone: string
          p_delivery_address: Json
          p_delivery_date: string
          p_delivery_payout: number
          p_delivery_time_slot?: string
          p_items: Json
          p_order_id: string
          p_payment_method: string
          p_payment_status: string
          p_total_amount: number
        }
        Returns: string
      }
      is_approved_seller: { Args: { user_uuid?: string }; Returns: boolean }
      is_current_user_admin_v2: { Args: never; Returns: boolean }
      is_location_serviceable: {
        Args: {
          customer_lat: number
          customer_lon: number
          max_distance_km?: number
        }
        Returns: boolean
      }
      is_user_eligible_for_coupon: {
        Args: { p_coupon_id: string; p_user_id: string }
        Returns: boolean
      }
      log_secret_code_usage: {
        Args: {
          input_code: string
          user_agent_string?: string
          user_email: string
          user_full_name: string
          user_ip?: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_ip_address?: unknown
          p_resource: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_vacation_cancellation: {
        Args: {
          p_cancelled_by?: string
          p_metadata?: Json
          p_reason?: string
          p_subscription_id: string
          p_user_id: string
          p_vacation_id: string
        }
        Returns: undefined
      }
      lookup_order_by_tracking_id: {
        Args: { tracking_id_input: string }
        Returns: Json
      }
      manual_complete_delivery: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method?: string
        }
        Returns: Json
      }
      manual_process_subscriptions: {
        Args: { p_processing_date?: string }
        Returns: Json
      }
      manual_trigger_subscription_processing: { Args: never; Returns: Json }
      mark_order_as_packed: { Args: { order_id: string }; Returns: undefined }
      mark_order_as_packed_simple: { Args: { order_id: string }; Returns: Json }
      mark_order_as_packed_v2: {
        Args: { order_id: string }
        Returns: undefined
      }
      mark_payout_paid: { Args: { payout_id: string }; Returns: undefined }
      notify_nearby_delivery_agents: {
        Args: { p_order_id: string }
        Returns: number
      }
      nuclear_complete_delivery_bypass: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      populate_daily_deals_and_offers: { Args: never; Returns: Json }
      preview_daily_orders: {
        Args: { preview_date?: string }
        Returns: {
          customer_id: string
          customer_name: string
          location_id: number
          order_date: string
          product_id: string
          quantity: number
          subscription_id: string
          subscription_type: string
        }[]
      }
      process_daily_subscriptions_with_notifications:
        | { Args: never; Returns: Json }
        | { Args: { p_scheduled_time?: string }; Returns: Json }
      process_delivery_payout: {
        Args: {
          p_agent_id: string
          p_delivery_time?: string
          p_distance_km: number
          p_order_id: string
        }
        Returns: Json
      }
      process_delivery_payout_safe: {
        Args: {
          p_agent_id: string
          p_delivery_time?: string
          p_distance_km?: number
          p_order_id: string
        }
        Returns: Json
      }
      process_due_existing_subscriptions: { Args: never; Returns: number }
      process_due_subscriptions: { Args: never; Returns: number }
      process_subscriptions_update_dates_only: { Args: never; Returns: Json }
      process_subscriptions_with_order_creation:
        | { Args: never; Returns: Json }
        | {
            Args: {
              p_send_notifications?: boolean
              p_target_delivery_date: string
            }
            Returns: Json
          }
      qr_complete_delivery_v3: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method?: string
        }
        Returns: Json
      }
      reassign_absent_agents_today: { Args: never; Returns: undefined }
      reconcile_completed_orders: { Args: never; Returns: Json }
      refresh_todays_best_deals: { Args: never; Returns: undefined }
      regenerate_all_product_tags: {
        Args: never
        Returns: {
          new_tags: string[]
          product_id: string
          product_name: string
        }[]
      }
      reject_delivery_agent: {
        Args: { p_admin_user_id: string; p_agent_id: string; p_reason?: string }
        Returns: Json
      }
      reject_order: {
        Args: { p_agent_id: string; p_order_id: string; p_reason?: string }
        Returns: Json
      }
      reject_product_in_order: {
        Args: {
          p_order_id: string
          p_product_id: string
          p_reason?: string
          p_seller_id: string
        }
        Returns: Json
      }
      reject_user: {
        Args: { admin_user_id: string; reason?: string; target_user_id: string }
        Returns: Json
      }
      repair_subscription_dates: { Args: never; Returns: Json }
      request_secret_code_reset: {
        Args: {
          requester_email: string
          requester_name?: string
          reset_reason?: string
        }
        Returns: Json
      }
      reset_daily_agent_counters: { Args: never; Returns: undefined }
      reset_daily_delivery_counts: { Args: never; Returns: undefined }
      resolve_agent_email: { Args: { identifier: string }; Returns: string }
      resume_expired_vacations: { Args: never; Returns: Json }
      safe_complete_delivery: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method: string
        }
        Returns: Json
      }
      sanitize_input: { Args: { input_text: string }; Returns: string }
      scan_qr_and_deliver_order: {
        Args: { agent_id: string; order_id: string; qr_code_id: string }
        Returns: boolean
      }
      seller_order_action: {
        Args: { p_action: string; p_order_id: string; p_seller_user_id: string }
        Returns: Json
      }
      send_birthday_messages: { Args: never; Returns: number }
      send_subscription_notification: {
        Args: {
          p_notification_type?: string
          p_order_id: string
          p_subscription_id: string
        }
        Returns: boolean
      }
      settle_cod_automatically: {
        Args: { p_agent_id: string; p_cod_amount: number; p_order_id: string }
        Returns: Json
      }
      settle_cod_to_admin: {
        Args: { p_agent_id: string; p_amount: number }
        Returns: Json
      }
      should_create_same_day_order: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      should_skip_delivery_for_vacation_v2: {
        Args: { p_delivery_date: string; p_subscription_id: string }
        Returns: boolean
      }
      should_skip_delivery_for_vacation_v3: {
        Args: { p_delivery_date: string; p_subscription_id: string }
        Returns: boolean
      }
      simple_complete_delivery_final: {
        Args: { p_order_id: string; p_payment_method?: string }
        Returns: Json
      }
      simple_mark_delivered: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_method?: string
        }
        Returns: Json
      }
      sync_special_offers_from_products: { Args: never; Returns: undefined }
      sync_user_player_id: {
        Args: { device_info?: Json; player_id: string; target_user_id: string }
        Returns: boolean
      }
      test_subscription_processing: { Args: never; Returns: Json }
      track_product_view: { Args: { p_product_id: string }; Returns: undefined }
      trigger_immediate_processing_after_vacation_cancel: {
        Args: { p_metadata?: Json; p_reason?: string; p_user_id: string }
        Returns: Json
      }
      trigger_subscription_processing: { Args: never; Returns: string }
      ultra_simple_complete_delivery: {
        Args: {
          p_agent_id: string
          p_order_id: string
          p_payment_status: string
        }
        Returns: Json
      }
      update_order_status: {
        Args: {
          p_agent_id: string
          p_new_payment_status: string
          p_new_status: string
          p_order_id: string
        }
        Returns: undefined
      }
      update_seller_location_from_current: {
        Args: {
          current_address?: Json
          current_lat: number
          current_lng: number
          seller_user_id: string
        }
        Returns: boolean
      }
      update_seller_order_status: {
        Args: { p_action: string; p_order_id: string; p_seller_user_id: string }
        Returns: Json
      }
      update_subscription_next_delivery: {
        Args: { p_subscription_id: string }
        Returns: Json
      }
      update_subscription_next_delivery_dates: {
        Args: never
        Returns: undefined
      }
      update_subscription_next_delivery_ist: {
        Args: { p_subscription_id: string }
        Returns: Json
      }
      update_trending_products: { Args: never; Returns: undefined }
      upsert_delivery_agent: {
        Args: {
          p_agent_id: string
          p_email: string
          p_name: string
          p_phone: string
        }
        Returns: string
      }
      validate_bank_details_v2: {
        Args: {
          account_holder_name: string
          account_number: string
          bank_name: string
          ifsc_code: string
        }
        Returns: boolean
      }
      validate_order_for_completion: {
        Args: { p_order_id: string }
        Returns: Json
      }
      validate_reset_token: { Args: { token: string }; Returns: boolean }
      validate_secret_code: { Args: { input_code: string }; Returns: boolean }
      verify_agent_document: {
        Args: {
          p_agent_id: string
          p_document_type: string
          p_verified_by: string
        }
        Returns: Json
      }
      verify_order_otp: {
        Args: { p_agent_id: string; p_order_id: string; p_otp_code: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "agent" | "seller" | "rider"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "agent", "seller", "rider"],
    },
  },
} as const
