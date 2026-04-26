"""create payments table

Revision ID: 0002_create_payments
Revises: (put your current latest revision ID here)
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa

# ── IMPORTANT: set this to your current latest alembic revision ID ────────────
# Run `alembic history` to find it. Example: "0001_initial" or an auto-hash.
down_revision = None   # ← REPLACE with your actual current revision ID
revision = "0002_create_payments"
branch_labels = None
depends_on = None
# ─────────────────────────────────────────────────────────────────────────────


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id",             sa.Integer(),    primary_key=True, autoincrement=True),
        sa.Column("user_id",        sa.Integer(),    nullable=False),
        sa.Column("user_name",      sa.String(),     nullable=True),
        sa.Column("user_email",     sa.String(),     nullable=True),
        sa.Column("order_id",       sa.String(),     nullable=False, unique=True),
        sa.Column("amount",         sa.Float(),      nullable=False),
        sa.Column("currency",       sa.String(),     server_default="INR"),
        sa.Column("status",         sa.Enum("PENDING", "PAID", "FAILED", "REFUNDED",
                                            name="paymentstatus"),
                                    nullable=False, server_default="PENDING"),
        sa.Column("paid_at",        sa.DateTime(),   nullable=True),
        sa.Column("valid_till",     sa.DateTime(),   nullable=True),
        sa.Column("cf_payment_id",  sa.String(),     nullable=True),
        sa.Column("cf_order_status",sa.String(),     nullable=True),
        sa.Column("created_at",     sa.DateTime(),   server_default=sa.func.now()),
        sa.Column("updated_at",     sa.DateTime(),   server_default=sa.func.now(),
                                    onupdate=sa.func.now()),
    )
    op.create_index("ix_payments_user_id",  "payments", ["user_id"])
    op.create_index("ix_payments_order_id", "payments", ["order_id"])
    op.create_index("ix_payments_status",   "payments", ["status"])


def downgrade() -> None:
    op.drop_index("ix_payments_status",   table_name="payments")
    op.drop_index("ix_payments_order_id", table_name="payments")
    op.drop_index("ix_payments_user_id",  table_name="payments")
    op.drop_table("payments")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
