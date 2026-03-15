"""Create all tables

Revision ID: 0001_initial
Revises:
Create Date: 2024-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def _ohlcv(table_name):
    op.create_table(table_name,
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('open', sa.Numeric(12, 4), nullable=False),
        sa.Column('high', sa.Numeric(12, 4), nullable=False),
        sa.Column('low', sa.Numeric(12, 4), nullable=False),
        sa.Column('close', sa.Numeric(12, 4), nullable=False),
        sa.Column('volume', sa.BigInteger(), nullable=True, server_default='0'),
        sa.Column('oi', sa.BigInteger(), nullable=True, server_default='0'),
        sa.Column('is_partial', sa.Boolean(), nullable=True, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('symbol', 'timestamp', name=f'uq_{table_name}_sym_ts'),
    )
    op.create_index(f'ix_{table_name}_sym_ts', table_name, ['symbol', 'timestamp'])
    op.create_index(f'ix_{table_name}_ts', table_name, ['timestamp'])


def upgrade():
    op.create_table('users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='uq_users_email'),
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_email', 'users', ['email'])

    op.create_table('symbols',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('instrument_token', sa.Integer(), nullable=True),
        sa.Column('exchange', sa.String(10), nullable=True, server_default='NSE'),
        sa.Column('name', sa.String(200), nullable=True),
        sa.Column('sector', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('last_updated', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('symbol', name='uq_symbols_symbol'),
    )
    op.create_index('ix_symbols_symbol', 'symbols', ['symbol'])

    for tbl in ['ohlcv_1min', 'ohlcv_5min', 'ohlcv_15min', 'ohlcv_1hour',
                'ohlcv_1day', 'ohlcv_1week', 'ohlcv_1month']:
        _ohlcv(tbl)

    op.create_table('live_ticks',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('instrument_token', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('last_price', sa.Numeric(12, 4), nullable=False),
        sa.Column('volume', sa.BigInteger(), nullable=True),
        sa.Column('oi', sa.BigInteger(), nullable=True),
        sa.Column('bid', sa.Numeric(12, 4), nullable=True),
        sa.Column('ask', sa.Numeric(12, 4), nullable=True),
        sa.Column('received_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_live_ticks_sym_ts', 'live_ticks', ['symbol', 'timestamp'])

    op.create_table('kite_sessions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('access_token', sa.Text(), nullable=False),
        sa.Column('request_token', sa.Text(), nullable=True),
        sa.Column('public_token', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('backfill_jobs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('timeframe', sa.String(10), nullable=False),
        sa.Column('status', sa.String(20), nullable=True, server_default='pending'),
        sa.Column('from_date', sa.DateTime(), nullable=True),
        sa.Column('to_date', sa.DateTime(), nullable=True),
        sa.Column('records_inserted', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('error_msg', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('symbol', 'timeframe', name='uq_backfill_sym_tf'),
    )
    op.create_index('ix_backfill_status', 'backfill_jobs', ['status'])


def downgrade():
    for tbl in ['backfill_jobs', 'kite_sessions', 'live_ticks', 'symbols',
                'ohlcv_1min', 'ohlcv_5min', 'ohlcv_15min', 'ohlcv_1hour',
                'ohlcv_1day', 'ohlcv_1week', 'ohlcv_1month', 'users']:
        op.drop_table(tbl)
