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
      agent_settings: {
        Row: {
          agent_id: string
          auto_logout: boolean | null
          created_at: string | null
          id: string
          language: string | null
          location_services: boolean | null
          personal_info: Json | null
          preferred_areas: Json | null
          push_notifications: boolean | null
          sound_alerts: boolean | null
          updated_at: string | null
          vehicle_info: Json | null
          vibration: boolean | null
        }
        Insert: {
          agent_id: string
          auto_logout?: boolean | null
          created_at?: string | null
          id?: string
          language?: string | null
          location_services?: boolean | null
          personal_info?: Json | null
          preferred_areas?: Json | null
          push_notifications?: boolean | null
          sound_alerts?: boolean | null
          updated_at?: string | null
          vehicle_info?: Json | null
          vibration?: boolean | null
        }
        Update: {
          agent_id?: string
          auto_logout?: boolean | null
          created_at?: string | null
          id?: string
          language?: string | null
          location_services?: boolean | null
          personal_info?: Json | null
          preferred_areas?: Json | null
          push_notifications?: boolean | null
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
          amount: number
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
          email: string
          id: string
          is_active: boolean | null
          is_online: boolean | null
          last_delivery_at: string | null
          last_status_change: string | null
          name: string
          performance_score: number | null
          phone: string | null
          total_deliveries: number | null
          total_earnings: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          average_rating?: number | null
          created_at?: string | null
          deliveries_today?: number | null
          email: string
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_delivery_at?: string | null
          last_status_change?: string | null
          name: string
          performance_score?: number | null
          phone?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          average_rating?: number | null
          created_at?: string | null
          deliveries_today?: number | null
          email?: string
          id?: string
          is_active?: boolean | null
          is_online?: boolean | null
          last_delivery_at?: string | null
          last_status_change?: string | null
          name?: string
          performance_score?: number | null
          phone?: string | null
          total_deliveries?: number | null
          total_earnings?: number | null
          updated_at?: string | null
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
          order_id: string | null
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
          order_id?: string | null
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
          order_id?: string | null
          role?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_agents"
            referencedColumns: ["id"]
          },
        ]
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
      orders: {
        Row: {
          address: Json
          agent_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          delivered: boolean | null
          delivered_at: string | null
          delivery_address_id: string | null
          delivery_date: string | null
          delivery_time: string | null
          delivery_time_slot: string | null
          id: string
          items: Json
          payment_id: string | null
          payment_status: string | null
          settlement_locked: boolean | null
          special_instructions: string | null
          status: string
          subscription_id: string | null
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: Json
          agent_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_date?: string | null
          delivery_time?: string | null
          delivery_time_slot?: string | null
          id?: string
          items: Json
          payment_id?: string | null
          payment_status?: string | null
          settlement_locked?: boolean | null
          special_instructions?: string | null
          status?: string
          subscription_id?: string | null
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: Json
          agent_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          delivery_address_id?: string | null
          delivery_date?: string | null
          delivery_time?: string | null
          delivery_time_slot?: string | null
          id?: string
          items?: Json
          payment_id?: string | null
          payment_status?: string | null
          settlement_locked?: boolean | null
          special_instructions?: string | null
          status?: string
          subscription_id?: string | null
          total?: number
          updated_at?: string
          user_id?: string | null
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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
          expires_at: string
          id: string
          otp: string
          phone: string
          updated_at: string | null
          user_data: Json | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          otp: string
          phone: string
          updated_at?: string | null
          user_data?: Json | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          otp?: string
          phone?: string
          updated_at?: string | null
          user_data?: Json | null
          verified?: boolean | null
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
          benefits: string[] | null
          category: string | null
          category_id: string | null
          created_at: string
          description: string | null
          discount_percentage: number | null
          id: string
          image_url: string | null
          images: string[] | null
          ingredients: string[] | null
          is_active: boolean
          name: string
          nutritional_info: Json | null
          price: number
          seller_id: string | null
          stock_quantity: number | null
          total_reviews: number | null
          type: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          benefits?: string[] | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          ingredients?: string[] | null
          is_active?: boolean
          name: string
          nutritional_info?: Json | null
          price: number
          seller_id?: string | null
          stock_quantity?: number | null
          total_reviews?: number | null
          type?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          benefits?: string[] | null
          category?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          ingredients?: string[] | null
          is_active?: boolean
          name?: string
          nutritional_info?: Json | null
          price?: number
          seller_id?: string | null
          stock_quantity?: number | null
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
          emergency_contact: string | null
          full_name: string | null
          id: string
          notification_preferences: Json | null
          phone: string | null
          photo_uploaded_at: string | null
          photo_url: string | null
          photo_verified: boolean | null
          rejection_reason: string | null
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
          emergency_contact?: string | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photo_verified?: boolean | null
          rejection_reason?: string | null
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
          emergency_contact?: string | null
          full_name?: string | null
          id?: string
          notification_preferences?: Json | null
          phone?: string | null
          photo_uploaded_at?: string | null
          photo_url?: string | null
          photo_verified?: boolean | null
          rejection_reason?: string | null
          updated_at?: string
          user_id?: string
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
          ip_address: unknown | null
          resource: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          email: string
          id: string
          ifsc_code: string | null
          is_bank_verified: boolean | null
          latitude: number | null
          location_verified: boolean | null
          longitude: number | null
          name: string
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
          email: string
          id?: string
          ifsc_code?: string | null
          is_bank_verified?: boolean | null
          latitude?: number | null
          location_verified?: boolean | null
          longitude?: number | null
          name: string
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
          email?: string
          id?: string
          ifsc_code?: string | null
          is_bank_verified?: boolean | null
          latitude?: number | null
          location_verified?: boolean | null
          longitude?: number | null
          name?: string
          phone?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
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
          delivery_address: Json | null
          delivery_days: string[] | null
          delivery_time: string | null
          delivery_time_slot: string | null
          end_date: string | null
          id: string
          is_active: boolean
          next_delivery_date: string
          notification_advance_hours: number | null
          product_id: string
          quantity: number
          special_instructions: string | null
          start_date: string
          subscription_type: string
          total_credit_earned: number | null
          updated_at: string
          user_id: string
          vacation_days_used: number | null
          vacation_extension_days: number | null
        }
        Insert: {
          available_credit?: number | null
          created_at?: string
          delivery_address?: Json | null
          delivery_days?: string[] | null
          delivery_time?: string | null
          delivery_time_slot?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          next_delivery_date: string
          notification_advance_hours?: number | null
          product_id: string
          quantity?: number
          special_instructions?: string | null
          start_date?: string
          subscription_type: string
          total_credit_earned?: number | null
          updated_at?: string
          user_id: string
          vacation_days_used?: number | null
          vacation_extension_days?: number | null
        }
        Update: {
          available_credit?: number | null
          created_at?: string
          delivery_address?: Json | null
          delivery_days?: string[] | null
          delivery_time?: string | null
          delivery_time_slot?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          next_delivery_date?: string
          notification_advance_hours?: number | null
          product_id?: string
          quantity?: number
          special_instructions?: string | null
          start_date?: string
          subscription_type?: string
          total_credit_earned?: number | null
          updated_at?: string
          user_id?: string
          vacation_days_used?: number | null
          vacation_extension_days?: number | null
        }
        Relationships: []
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
          agent_phone: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered: boolean | null
          delivery_date: string | null
          delivery_time_slot: string | null
          id: string | null
          items: Json | null
          payment_status: string | null
          special_instructions: string | null
          status: string | null
          total: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
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
      activate_delivery_agent: {
        Args: { agent_email: string }
        Returns: Json
      }
      apply_coupon: {
        Args:
          | { p_coupon_code: string; p_order_total: number }
          | { p_coupon_code: string; p_order_total: number; p_user_id?: string }
        Returns: Json
      }
      apply_targeted_coupon: {
        Args: { p_coupon_code: string; p_order_total?: number }
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
      assign_order_to_agent: {
        Args: { p_agent_id: string; p_order_id: string }
        Returns: Json
      }
      assign_rider: {
        Args: { _agent_id: string; _order_id: string }
        Returns: undefined
      }
      calculate_delivery_payout: {
        Args: {
          agent_id_param?: string
          delivery_time?: string
          distance_km: number
        }
        Returns: Json
      }
      calculate_distance: {
        Args:
          | { lat1: number; lat2: number; lon1: number; lon2: number }
          | { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_next_delivery_date: {
        Args:
          | {
              current_hour?: number
              input_current_date?: string
              last_delivery_date?: string
              subscription_type: string
            }
          | {
              input_current_date?: string
              last_delivery_date?: string
              subscription_type: string
            }
          | {
              p_current_date: string
              p_frequency_days: string[]
              p_frequency_type: string
              p_frequency_value: number
            }
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
      calculate_vacation_credit: {
        Args: {
          p_end_date: string
          p_start_date: string
          p_subscription_id: string
        }
        Returns: number
      }
      can_register_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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
      cleanup_expired_otps: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      clear_user_cart: {
        Args: { cart_user_id: string }
        Returns: undefined
      }
      complete_cod_delivery: {
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
      create_birthday_coupons: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_delivery_agent: {
        Args: {
          agent_email: string
          agent_name: string
          agent_phone?: string
          custom_agent_id?: string
        }
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
      create_vacation_period: {
        Args:
          | {
              p_end_date: string
              p_start_date: string
              p_subscription_id: string
            }
          | {
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
      ensure_delivery_data_consistency: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      extract_seller_ids_from_order: {
        Args: { order_items: Json }
        Returns: string[]
      }
      fix_uncategorized_products: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      generate_order_qr_code: {
        Args: { order_uuid: string }
        Returns: string
      }
      get_agent_distance_stats: {
        Args: { agent_uuid: string }
        Returns: Json
      }
      get_agent_hours_today: {
        Args: { agent_uuid: string }
        Returns: number
      }
      get_agent_performance: {
        Args: Record<PropertyKey, never> | { limit_count?: number }
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
      get_agent_work_stats: {
        Args: { agent_uuid: string }
        Returns: Json
      }
      get_all_user_categories: {
        Args: Record<PropertyKey, never>
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
        Args: Record<PropertyKey, never>
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
      get_cart_total: {
        Args: { cart_user_id: string }
        Returns: number
      }
      get_current_user_category: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_delivery_agent_analytics: {
        Args: { time_period?: string }
        Returns: {
          agent_email: string
          agent_id: string
          agent_name: string
          average_rating: number
          completion_rate: number
          deliveries_today: number
          is_active: boolean
          is_online: boolean
          last_delivery_at: string
          period_label: string
          phone: string
          successful_deliveries: number
          total_deliveries: number
          total_distance: number
          total_earnings: number
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
      get_products_within_range: {
        Args:
          | { customer_lat: number; customer_lon: number; range_km?: number }
          | { customer_lat: number; customer_lon: number; range_km?: number }
        Returns: {
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
          product_statuses: Json
          special_instructions: string
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
          total_amount: number
          updated_at: string
        }[]
      }
      get_seller_stats: {
        Args: { seller_user_id: string }
        Returns: Json
      }
      get_seller_stats_with_period: {
        Args: { seller_user_id: string; time_period?: string }
        Returns: Json
      }
      get_top_products: {
        Args: Record<PropertyKey, never> | { limit_count?: number }
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
      get_user_category_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_eligible_coupons: {
        Args: { p_user_id?: string }
        Returns: {
          birthday_month_target: boolean
          code: string
          description: string
          discount_type: string
          discount_value: number
          high_spenders_only: boolean
          id: string
          is_active: boolean
          is_eligible: boolean
          low_spenders_only: boolean
          maximum_discount_amount: number
          maximum_user_spending: number
          minimum_user_spending: number
          name: string
          new_users_only: boolean
          returning_users_only: boolean
          targeting_reason: string
          usage_limit: number
          used_count: number
          valid_from: string
          valid_until: string
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
      is_admin: {
        Args: { user_email: string }
        Returns: boolean
      }
      is_approved_seller: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_current_user_admin_v2: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
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
      manual_trigger_subscription_processing: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      mark_payout_paid: {
        Args: { payout_id: string }
        Returns: undefined
      }
      notify_nearby_delivery_agents: {
        Args: { p_order_id: string }
        Returns: number
      }
      process_daily_subscriptions_with_notifications: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
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
      process_due_existing_subscriptions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      process_due_subscriptions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      refresh_todays_best_deals: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      request_secret_code_reset: {
        Args: {
          requester_email: string
          requester_name?: string
          reset_reason?: string
        }
        Returns: Json
      }
      reset_daily_delivery_counts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      resolve_agent_email: {
        Args: { identifier: string }
        Returns: string
      }
      sanitize_input: {
        Args: { input_text: string }
        Returns: string
      }
      scan_qr_and_deliver_order: {
        Args: { agent_id: string; order_id: string; qr_code_id: string }
        Returns: boolean
      }
      send_birthday_messages: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
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
      should_skip_delivery_for_vacation: {
        Args: { p_delivery_date: string; p_subscription_id: string }
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
      sync_special_offers_from_products: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      trigger_subscription_processing: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      update_subscription_next_delivery_dates: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_trending_products: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
      validate_reset_token: {
        Args: { token: string }
        Returns: boolean
      }
      validate_secret_code: {
        Args: { input_code: string }
        Returns: boolean
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
